import { Menu, MenuItem } from '@playcanvas/pcui';

editor.once('load', () => {
    let entity = null; // the entity that was clicked on to open the context menu
    let items = [];   // the current selection
    const root = editor.call('layout.root');

    const legacyScripts = editor.call('settings:project').get('useLegacyScripts');

    // create data for entity menu
    let menu;

    const getSelection = function () {
        const selection = editor.call('selector:items');

        if (selection.indexOf(entity) !== -1) {
            return selection;
        }
        return [entity];

    };

    const setField = function (field, value) {
        const records = [];

        for (let i = 0; i < items.length; i++) {
            records.push({
                item: items[i],
                value: value,
                valueOld: items[i].get(field)
            });

            items[i].history.enabled = false;
            items[i].set(field, value);
            items[i].history.enabled = true;
        }

        editor.api.globals.history.add({
            name: `entities.set[${field}]`,
            combine: false,
            undo: function () {
                for (let i = 0; i < records.length; i++) {
                    const item = records[i].item.latest();
                    if (!item) {
                        continue;
                    }

                    item.history.enabled = false;
                    item.set(field, records[i].valueOld);
                    item.history.enabled = true;
                }
            },
            redo: function () {
                for (let i = 0; i < records.length; i++) {
                    const item = records[i].item.latest();
                    if (!item) {
                        continue;
                    }

                    item.history.enabled = false;
                    item.set(field, records[i].value);
                    item.history.enabled = true;
                }
            }
        });
    };

    // wait until all entities are loaded
    // before creating the menu to make sure
    // that the menu data for entities have been created
    editor.once('entities:load', () => {
        const menuData = [];

        const isOneSelected = () => items.length === 1;
        const hasWriteAccess = () => editor.call('permissions:write');

        menuData.push({
            text: 'New Entity',
            onIsEnabled: isOneSelected,
            onIsVisible: hasWriteAccess,
            onSelect: () => {
                editor.call('entities:new', { parent: items[0] });
            },
            items: editor.call('menu:entities:new', () => {
                return items[0];
            })
        });

        menuData.push({
            text: 'Add Component',
            onIsVisible: hasWriteAccess,
            items: editor.call('menu:entities:add-component')
        });

        if (!legacyScripts) {
            menuData.push({
                text: 'Template',
                icon: 'E411',
                onIsVisible: hasWriteAccess,
                items: editor.call('menu:entities:template')
            });
        }

        menuData.push({
            text: 'Enable',
            icon: 'E133',
            onIsVisible: function () {
                if (!hasWriteAccess()) return false;

                if (items.length === 1) {
                    return !items[0].get('enabled');
                }
                const enabled = items[0].get('enabled');
                for (let i = 1; i < items.length; i++) {
                    if (enabled !== items[i].get('enabled')) {
                        return true;
                    }
                }
                return !enabled;

            },
            onSelect: function () {
                setField('enabled', true);
            }
        });

        menuData.push({
            text: 'Disable',
            icon: 'E132',
            onIsVisible: function () {
                if (!hasWriteAccess()) return false;

                if (items.length === 1) {
                    return items[0].get('enabled');
                }
                const disabled = items[0].get('enabled');
                for (let i = 1; i < items.length; i++) {
                    if (disabled !== items[i].get('enabled')) {
                        return true;
                    }
                }
                return disabled;

            },
            onSelect: function () {
                setField('enabled', false);
            }
        });

        menuData.push({
            text: 'Rename',
            icon: 'E294',
            onIsEnabled: () => {
                return getSelection().length > 0;
            },
            onSelect: function () {
                const searchPattern = prompt(
                    "Search (regex or plain text, leave blank to change all):"
                );
                if (searchPattern === null) return;

                let newName = prompt("Change (e.g. {name}{i+1}):");
                if (newName === null) return;

                const regex = searchPattern ? new RegExp(searchPattern, "g") : null;
                let counter = 1;

                function processMathExpression(expression, index) {
                    try {
                        return eval(expression.replace("i", index));
                    } catch (e) {
                        console.error("Error:", expression);
                        return index;
                    }
                }

                getSelection().forEach((v) => {
                    let currentName = v.get("name");
                    let modifiedName = currentName;

                    if (regex) {
                        modifiedName = modifiedName.replace(regex, (match) => {
                            let newReplacement = newName;

                            if (newReplacement.includes("{name}")) {
                                newReplacement = newReplacement.replace(/{name}/g, currentName);
                            }

                            newReplacement = newReplacement.replace(/\{([^\}]+)\}/g, (_, expression) => {
                                return processMathExpression(expression, counter);
                            });

                            return newReplacement;
                        });
                    } else {
                        modifiedName = newName.replace(/{name}/g, currentName).replace(/\{([^\}]+)\}/g, (_, expression) => {
                            return processMathExpression(expression, counter);
                        });
                    }

                    counter++;
                    v.set("name", modifiedName);
                });
            }
        });

        menuData.push({
            text: 'Copy',
            icon: 'E351',
            onSelect: function () {
                editor.call('entities:copy', items);
            }
        });

        menuData.push({
            text: 'Paste',
            icon: 'E348',
            onIsVisible: hasWriteAccess,
            onIsEnabled: function () {
                if (items.length <= 1) {
                    const clipboard = editor.call('clipboard:get');
                    if (clipboard && clipboard.type === 'entity') {
                        return true;
                    }
                }

                return false;
            },
            onSelect: function () {
                editor.call('entities:paste', entity);
            }
        });

        menuData.push({
            text: 'Duplicate',
            icon: 'E126',
            onIsVisible: hasWriteAccess,
            onIsEnabled: function () {
                const items = getSelection();

                if (items.indexOf(editor.call('entities:root')) !== -1) {
                    return false;
                }

                return items.length > 0;
            },
            onSelect: function () {
                editor.call('entities:duplicate', getSelection());
            }
        });

        menuData.push({
            text: 'Delete',
            icon: 'E124',
            onIsVisible: hasWriteAccess,
            onIsEnabled: function () {
                const root = editor.call('entities:root');
                for (let i = 0; i < items.length; i++) {
                    if (items[i] === root) {
                        return false;
                    }
                }
                return true;
            },
            onSelect: function () {
                editor.call('entities:delete', items);
            }
        });

        menuData.push({
            text: 'Item History',
            icon: 'E399',
            onIsVisible: function () {
                return editor.call('permissions:write') && items.length === 1;
            },
            onSelect: function () {
                editor.call('vcgraph:utils', 'launchItemHist', 'entities', items[0].get('resource_id'));
            }
        });

        function getParentNames(item) {
            console.log(item);
            const names = [];
            names.push(item.entity.name);

            function a(item) {
                if (item.parent) {
                    names.push(item.parent.name);
                    a(item.parent);
                }
            }

            a(item.entity);
            return JSON.stringify(names.reverse());
        }

        menuData.push({
            text: 'Copy Path',
            icon: 'E144',
            onIsVisible: isOneSelected,
            onSelect: function () {
                navigator.clipboard.writeText(getParentNames(getSelection()[0]));
            }
        });

        // menu
        menu = new Menu({ items: menuData });
        root.append(menu);
    });

    editor.method('entities:contextmenu:add', (data) => {
        var item = new MenuItem({
            text: data.text,
            icon: data.icon,
            items: data.items,
            onSelect: () => {
                data.onSelect.call(item, getSelection());
            },
            onIsEnabled: () => {
                if (data.onIsEnabled) {
                    return data.onIsEnabled.call(item, getSelection());
                }

                return true;
            },
            onIsVisible: () => {
                if (data.onIsVisible) {
                    return data.onIsVisible.call(item, getSelection());
                }

                return true;
            }
        });

        menu.append(item);

        return item;
    });

    editor.method('entities:contextmenu:open', (item, x, y, ignoreSelection) => {
        if (!menu) return;

        entity = item;

        if (ignoreSelection) {
            items = [];
        } else {
            items = getSelection();
        }

        menu.hidden = false;
        menu.position(x + 1, y);

        return true;
    });

    // get the entity that was right-clicked when opening the context menu
    editor.method('entities:contextmenu:entity', () => {
        return entity;
    });

});
