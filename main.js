define(function (require, exports, module) {
    "use strict";
    
    // Brackets modules
    var CommandManager      = brackets.getModule("command/CommandManager"),
        Commands            = brackets.getModule("command/Commands"),
        KeyBindingManager   = brackets.getModule("command/KeyBindingManager"),
        Menus               = brackets.getModule("command/Menus"),
        EditorManager       = brackets.getModule("editor/EditorManager"),
        QuickOpen           = brackets.getModule("search/QuickOpen"),
        StringUtils         = brackets.getModule("utils/StringUtils");
    
    
    /** @type {Array.<{ id:string, name:string }>} */
    var _commandList;
    var whichEditor;
    
    
    function ensureCommandList() {
        var _menuContainer = null;
        if (_commandList) {
            return;
        }
        _commandList = [];
        
        var ids = CommandManager.getAll();
        
        var menuIds = $.map(Menus.AppMenuBar, function (menuConstVal, menuConstName) {
            return menuConstVal;
        });
        
        // Filter command list accordingly
        ids.forEach(function (id) {
            var noArgsOk = false;
            // Does it have a keybinding?
            if (KeyBindingManager.getKeyBindings(id).length > 0) {
                noArgsOk = true;
            } 
            
            // Is it in the menu bar?
            menuIds.forEach(function (menuId) {
                var menu = Menus.getMenu(menuId);
                var menuItemId = menu && menu._getMenuItemForCommand(CommandManager.get(id));
                if (menuItemId) {
                    _menuContainer = menuId.split('-')[0];
                }
            });
            if (noArgsOk) {
                _commandList.push({
                    id: id,
                    name: (_menuContainer+' -> ' || "") + CommandManager.get(id).getName()
                    // (getName() undefined for CommandManager.registerInternal(), but those commands should have been filtered out above anyway)
                });
            }
        });
    }
    
    function done() {
        // No cleanup - keep cached list of commands for next invocation
    }
    
    function search(query, matcher) {
        ensureCommandList();
        
        query = query.substr(1);
        
        var stringMatch = (matcher && matcher.match) ? matcher.match.bind(matcher) : QuickOpen.stringMatch;
        
        // Filter and rank how good each match is
        var filteredList = $.map(_commandList, function (commandInfo) {
            
            
            var searchResult = stringMatch(commandInfo.name, query);
            if (searchResult) {
                searchResult.id = commandInfo.id;
            }
            return searchResult;
        });
        
        QuickOpen.basicMatchSort(filteredList);

        return filteredList;
    }

    function match(query) {
        if (query.indexOf("/") === 0) {
            return true;
        }
    }

    function itemSelect(selectedItem) {
        // Many commands are focus-sensitive, so we have to carefully make sure that focus is restored to
        // the (correct) editor before running the command
        
        // First wait for Quick Open to restore focus to the master editor
        setTimeout(function () {
            // Now set focus on the correct editor (which might be an inline editor)
            if (whichEditor) {
                whichEditor.focus();
                whichEditor = null;
            }
            
            // One more timeout to wait for focus to move to that editor
            setTimeout(function () {
                CommandManager.execute(selectedItem.id);
            }, 0);
        }, 0);
    }
    
    function resultFormatter(item, query) {
        var displayName = QuickOpen.highlightMatch(item);
        var shortcuts = KeyBindingManager.getKeyBindings(item.id);
        var shortcut = shortcuts.length ? KeyBindingManager.formatKeyDescriptor(shortcuts[0].displayKey) : "";

        return "<li>" + displayName + "<span style='float:right'>" + shortcut + "</span></li>";
    }
    
    
    // Register as a new Quick Open mode
    QuickOpen.addQuickOpenPlugin(
        {
            name: "",
            label: "Menu Search",  // ignored before Sprint 34
            languageIds: [],  // empty array = all file types  (Sprint 23+)
            fileTypes:   [],  // (< Sprint 23)
            done: done,
            search: search,
            match: match,
            itemFocus: function () {},
            itemSelect: itemSelect,
            resultsFormatter: resultFormatter
        }
    );
    
    function beginSearchForCommands() {
        whichEditor = EditorManager.getFocusedEditor();
        
        // Begin Quick Open in our search mode
        QuickOpen.beginSearch("/");
    }
    

    // Register command as shortcut to launch this Quick Open mode
    var SEARCH_COMMAND_ID = "quick.searchMenu";
    CommandManager.register("Search Submenu", SEARCH_COMMAND_ID, beginSearchForCommands);
    
    var menu = Menus.getMenu(Menus.AppMenuBar.HELP_MENU);
    menu.addMenuDivider(Menus.FIRST);
    menu.addMenuItem(SEARCH_COMMAND_ID, [
        {key: "Ctrl-P", displayKey: "Ctrl-P"},
    ], Menus.FIRST);
});
