define(["dojo/_base/declare",
        "require",
        "dijit/_Templated",
        'dojo/_base/lang',
        'dojo/_base/event',
        'dojo/on',
        'dojox/grid/DataGrid',
        'dojo/data/ItemFileWriteStore',
        'dijit/form/Button',
        'dojo/dom',
        'dojox/xml/parser',
        'dijit/Dialog',
        "com.ibm.team.process.web.ui.operationbehavior.AbstractOperationBehaviorCustomEditor",
        "com.ibm.team.rtc.foundation.web.ui.widgets.CheckBox",
        "com.ibm.team.rtc.foundation.web.ui.widgets.CheckboxTree",
        "com.ibm.team.rtc.foundation.web.ui.widgets.CheckboxTreeNode",
        "com.ibm.team.workitem.web.process.ui.internal.configdata.model.WorkItemTypesModelStore"

    ],
    function (declare, require, _Templated, lang, event, on, DataGrid, ItemFileWriteStore, Button, dom, Parser, Dialog) {
        var team = com.ibm.team;
        var AbstractOperationBehaviorCustomEditor = team.process.web.ui.operationbehavior.AbstractOperationBehaviorCustomEditor;
        var WorkItemTypesModelStore = team.workitem.web.process.ui.internal.configdata.model.WorkItemTypesModelStore;

        return declare("com.siemens.bt.jazz.viewlet.setOwnerUi.SetOwnerEditor", [AbstractOperationBehaviorCustomEditor, _Templated], {

                templatePath: dojo.moduleUrl("com.siemens.bt.jazz.viewlet.setOwnerUi", "templates/StateBasedModificationEditor.html"),


                constructor: function constructor_$0(params) {
                    this._changesPending = false;
                },

                postCreate: function postCreate_$1() {
                    this.inherited("postCreate", arguments, []);
                    this._isDestroyed = false;

                },

                initialize: function initialize_$2(content, operationBehaviorId) {
                    this.inherited("initialize", arguments, [content, operationBehaviorId]);
                    this._content = content;
                    var procInfo = this.getProcessInformation();
                    this.roles = procInfo._rolesStore.getAllDefinedRoles();
                    var onSuccess = dojo.hitch(this, "_onReceivingSuccess");
                    var onFailure = dojo.hitch(this, "_onReceivingError");
                    var result = WorkItemTypesModelStore.fetchConfigurationData(procInfo);
                    result.then(onSuccess, onFailure);
                    this._changesPending = false;

                },

                //returns the xml for process source
                getContent: function getContent_$3() {
                    var returnString = "<followup-action>";
                    this.store._arrayOfAllItems.forEach(
                        function (element) {
                            if ("None" === element.method[0]) return;
                            var tempString = '<Workitem type="' + element.typeId[0] + '" method="' + element.method[0] + '"';
                            if (element.hasOwnProperty("roleId")) {
                                tempString = tempString + ' role="' + element.roleId[0] + '" ';
                            }
                            returnString = returnString + tempString + '/>';
                        });
                    return returnString + "</followup-action>";
                },

                //gets called to see if save button should be enabled
                changesPending: function changesPending_$4() {
                    return this._changesPending;
                },

                //should return false if user input is invalid, but since this UI is only checkboxes is not necessary
                canSave: function canSave_$5() {
                    return true;
                },

                //returns error message if not valid, ideally in all those cases where canSave is false
                validate: function () {
                    return null;
                },

                destroy: function (preserveDom) {
                    this._isDestroyed = true;
                    this.inherited("destroy", arguments, [preserveDom]);
                },

                //reads out the rule from process source xml belonging to Workitemtype
                getRule: function (typeId) {
                    var rulesXML = Parser.parse(this._content);
                    var value = rulesXML.querySelector('Workitem[type="' + typeId + '"]');
                    var attributes;
                    if (value) {
                        attributes = value.attributes;
                        value = attributes.method.value;
                    }
                    else {
                        value = "None";
                    }
                    var method;
                    if (value === "Role") {
                        method = {
                            method: value,
                            roleId: attributes.role.value,
                            roleLabel: this._getRoleLabel(attributes.role.value)
                        };
                    }
                    else {
                        method = {method: value}
                    }
                    return method;
                },

                //setup grid and store providing data for grid
                _makeGrid: function (types) {
                    var data = {
                        identifier: "typeId",
                        items: []
                    };
                    /* for each Workitemtype store: typeId, (type) label, method and optionally roleId + label*/
                    for (var i = 0; i < types.length; i++) {
                        data.items.push(lang.mixin({typeId: types[i].id, label: types[i].name}, this.getRule(types[i].id)));
                    }
                    this.store = new ItemFileWriteStore({data: data});

                    /*set up layout*/
                    var layout = [[
                        {'name': 'Type', 'field': 'label', 'width': '140px'},
                        {'name': 'Rule', 'field': '_item', 'formatter': this._formatMethod, 'width': '220px'}
                    ]];

                    /*create a new grid*/
                    var grid = new DataGrid({
                        id: 'grid',
                        store: this.store,
                        structure: layout,
                        onRowDblClick: dojo.hitch(this, "rowClicked"),
                        autoWidth: true,
                        autoHeight: true
                    });

                    /*append the new grid to the div*/
                    grid.placeAt(this._grid);

                    /*Call startup() to render the grid*/
                    grid.startup();

                    return node;

                },

                //find all the role Ids and labels and put them as neat radiobuttons
                _getRoles: function () {
                    var res = "";
                    for (var i = 0; i < this.roles.length; i++) {
                        res = res + '<input type="radio" name="radioGroup" value="' + this.roles[i].id + '"> Role: ' + this.roles[i].label + '<br>'
                    }
                    return res;
                },

                //if a row is doubleclicked open popup for editing
                rowClicked: function (e) {
                    var grid = e.grid;
                    var item = grid.getItem(e.rowIndex);
                    var store = grid.store;
                    this._getRoles();
                    var myDialog = new Dialog({
                        title: "<b>Choose a Rule</b>",
                        content: "<form>" +
                            "<input type=\"radio\" name=\"radioGroup\" value=\"Creator\"> Creator<br>" +
                            this._getRoles() +
                            "<input type=\"radio\" name=\"radioGroup\" value=\"None\"> None<br>" +
                            "<input type=\"button\" value=\"OK\"  onClick=\"storeForm(this.form)\">\n" +
                            "</form>",
                        style: "width: 300px"
                    });
                    //store the function under window, so the form inside the widget inside the widget can find it
                    window.storeForm = function storeForm(form) {
                        for (var i = 0; i < form.length - 1; i++) {
                            if (form[i].checked) {
                                var value = form[i].value;
                                if (value === "Creator" || value === "None") {
                                    store.setValue(item, "method", value);
                                }
                                else {
                                    store.setValue(item, "method", "Role");
                                    store.setValue(item, "roleId", value);
                                    store.setValue(item, "roleLabel", form[i].nextSibling.data.split(": ")[1]);
                                }
                            }
                        }
                        myDialog.destroy();
                    };

                    myDialog.show();
                    event.stop(e);
                    this._changesPending = true;
                    this.notifyContentChanged();
                },

                //Builds rule out of method + role, if any
                _formatMethod: function (item) {
                    var returnVal = item.method[0];
                    if (returnVal === "Role") {
                        returnVal += ": " + item.roleLabel[0];
                    }
                    return returnVal.toString();
                },

                //if typesmodel could be resolved to read out WI types make grid
                _onReceivingSuccess: function _onReceivingSuccess_$9(typesModel) {
                    this._makeGrid(typesModel.getAllTypes());
                },

                //else throw error
                _onReceivingError: function _onReceivingError_$15(error) {
                    console.error(String(error));
                    return error;
                },

                _getRoleLabel: function (roleId) {
                    var label = "";
                    this.roles.forEach(
                        function (role) {
                            if (roleId === role.id) {
                                label = role.label;
                            }
                        }
                    );
                    return label;
                }
            }
        );
    });


