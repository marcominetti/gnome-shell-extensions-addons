const Version = '0.7.8';
const ShellVersion = imports.misc.config.PACKAGE_VERSION.split(".");
const Mainloop = imports.mainloop;
const GMenu = imports.gi.GMenu;
const Lang = imports.lang;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const ModalDialog = imports.ui.modalDialog;
const AppFavorites = imports.ui.appFavorites;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const GnomeSession = imports.misc.gnomeSession;
const Cairo = imports.cairo;
const GLib = imports.gi.GLib;
const Signals = imports.signals;
const Layout = imports.ui.layout;
const Pango = imports.gi.Pango;
const Panel = imports.ui.panel;

let appsys = Shell.AppSystem.get_default();
let _session = new GnomeSession.SessionManager();

//Why are functions renames without creating a deprecated pointer..?
const cleanActor = (ShellVersion[1]<4) ? function(o) {return o.destroy_children();} : function(o) {return o.destroy_all_children();};
const insert_actor_to_box = (ShellVersion[1]<4) ? function(box,actor,position) {return box.insert_actor(actor,position);} : function(box,actor,position) {return box.insert_child_at_index(actor,position);};
const TextDirection = (ShellVersion[1]<4) ? St.TextDirection.LTR : Clutter.TextDirection.LTR ;
const getTextDirection = (ShellVersion[1]<4) ? function(actor) {return actor.get_direction();} : function(actor) {return actor.get_text_direction();};

function ApplicationButton(app,iconsize) {
    this._init(app,iconsize);
}
ApplicationButton.prototype = {
    _init: function(app,iconsize) {
        this.app = app;
        this.actor = new St.Button({ reactive: true, label: this.app.get_name(), style_class: 'application-button', x_align: St.Align.START });
        this.actor._delegate = this;
        this.buttonbox = new St.BoxLayout();
        let labelclass = AppFavorites.getAppFavorites().isFavorite(app.get_id())?'application-button-label-favorites':'application-button-label';
        this.label = new St.Label({ text: this.app.get_name(), style_class: labelclass });
        this.icon = this.app.create_icon_texture(iconsize);
        this.buttonbox.add_actor(this.icon);
        this.buttonbox.add(this.label, { y_align: St.Align.MIDDLE, y_fill: false });
        this.actor.set_child(this.buttonbox);
        this._releaseEventId = this.actor.connect('button-release-event', Lang.bind(this, this._onButtonRelease));
        this._clickEventId = this.actor.connect('clicked', Lang.bind(this, function() {
            this.app.open_new_window(-1);
            appsMenuButton.menu.close();
        }));
        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));
    },
    _onButtonRelease: function(actor, event){
        let button = event.get_button();
        if (button == 3) {
            if ( this._confirmDialog == null ) {
                this._confirmDialog = new confirmDialog(this.app);
            }
            this._confirmDialog.open();
        }
    },
    _onDestroy : function() {
        if (this._clickEventId) this.actor.disconnect(this._clickEventId);
        if (this._releaseEventId) this.actor.disconnect(this._releaseEventId);
    }
};
Signals.addSignalMethods(ApplicationButton.prototype);

function confirmDialog(app) {
    this._init(app);
}
confirmDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,
    _init: function(app) {
        ModalDialog.ModalDialog.prototype._init.call(this, { styleClass: 'confirm-dialog' });
        this._app = app;
        this.apFav = AppFavorites.getAppFavorites();
        this.is_fav = this.apFav.isFavorite(app.get_id());
        let headLabel = this.is_fav? "Remove \"%s\" from favorites?":"Add \"%s\" to favorites?";
        let header = new St.Label({ style_class: 'config-dialog-header', text: headLabel.format(this._app.get_name()) });
        this.contentLayout.add(header, { expand: true, x_fill: false, y_fill: false, x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE });
        let buttons = [{ action: Lang.bind(this, this._processApp),label:  "Yes" }, { action: Lang.bind(this, this._closeModal),label:  "No" }];
        this.setButtons(buttons);
        this._buttonLayout.style = ("padding-top: 50px;");
        this._actionKeys[Clutter.KEY_Escape] = Lang.bind(this, this._closeModal);
    },
    _processApp: function(){
        if(this.is_fav)
            this.apFav.removeFavorite(this._app.get_id());
        else
            this.apFav.addFavorite(this._app.get_id());
        this.close();
    },
    _closeModal: function(){
        this.close();
    }
};

function BaseButton(label,icon,iconsize,onclick) {
    this._init(label,icon,iconsize,onclick);
}
BaseButton.prototype = {
    _init: function(label,icon,iconsize,onclick) {
        this.actor = new St.Button({ reactive: true, label: label, style_class: 'application-button am-'+icon+'-button', x_align: St.Align.START });
        this.actor._delegate = this;
        this.buttonbox = new St.BoxLayout();
        if(icon){
            this.icon = new St.Icon({icon_name: icon, icon_size: iconsize});
            this.buttonbox.add_actor(this.icon);
        }
        if(label){
            this.label = new St.Label({ text: label, style_class: 'application-button-label' });
            this.buttonbox.add(this.label, { y_align: St.Align.MIDDLE, y_fill: false });
        }
        this.actor.set_child(this.buttonbox);
        this._clickEventId = this.actor.connect('clicked', Lang.bind(this, onclick));
        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));
    },
    _onDestroy : function() {
        if (this._clickEventId)
            this.actor.disconnect(this._clickEventId);
    }
};
Signals.addSignalMethods(BaseButton.prototype);

function CategoryButton(parent,category,iconSize) {
    this._init(parent,category,iconSize);
}
CategoryButton.prototype = {
    _init: function(parent,category,iconSize) {
        var label;
        this._parent = parent;
        this.category = category;
        if (category){
           let icon = category.get_icon();
           if (icon && icon.get_names)
               this.icon_name = icon.get_names().toString();
           else
               this.icon_name = "";
           label = category.get_name();
        }else label = "All applications";
        this.actor = new St.Button({ reactive: true, label: label, style_class: 'category-button', x_align: St.Align.START });
        this.actor._delegate = this;
        this.buttonbox = new St.BoxLayout();
        this.label = new St.Label({ text: label, style_class: 'category-button-label' });
        if (category && this.icon_name){
           this.icon = new St.Icon({icon_name: this.icon_name, icon_size: iconSize});
        }else{
            this.icon = new St.Icon({icon_name: 'start-here-symbolic', icon_size: iconSize});
        }
        this.buttonbox.add_actor(this.icon);
        this.buttonbox.add(this.label, { y_align: St.Align.MIDDLE, y_fill: false });
        this.actor.set_child(this.buttonbox);
        this._clickEventId = this.actor.connect('clicked', Lang.bind(this, function() {
            this._parent._select_category(this.category, this);
            this._parent._scrollToCatButton(this);
            this._parent.selectedAppTitle.set_text("");
            this._parent.selectedAppDescription.set_text("");
        }));
        if(!parent.cm.click_on_category)
            this._parent._addEnterEvent(this, Lang.bind(this, function() {
                this._parent._select_category(this.category, this);
                
                this._parent.selectedAppTitle.set_text("");
                this._parent.selectedAppDescription.set_text("");
            }));
        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));
    },
    _onDestroy : function() {
        if (this._clickEventId)
            this.actor.disconnect(this._clickEventId);
    }
};

Signals.addSignalMethods(CategoryButton.prototype);

function FavoritesButton(app,iconSize,favoritesText) {
    this._init(app,iconSize,favoritesText);
}
FavoritesButton.prototype = {
    _init: function(app,iconSize,favoritesText) {
        this._app = app;
        this.actor = new St.Button({ reactive: true, style_class: 'applications-menu-favorites-button', x_align: favoritesText?St.Align.START:St.Align.MIDDLE });
        this.actor._delegate = this;
        this.buttonbox = new St.BoxLayout();
        this.icon = this._app.create_icon_texture(iconSize);
        this.buttonbox.add_actor(this.icon);
        if(favoritesText){
            this.label = new St.Label({ text: this._app.get_name(), style_class: 'favorites-button-label' });
            this.buttonbox.add(this.label, { y_align: St.Align.MIDDLE, y_fill: false });
        }
        this.actor.set_child(this.buttonbox);
        this._releaseEventId = this.actor.connect('button-release-event', Lang.bind(this, this._onButtonRelease));
        this._clickEventId = this.actor.connect('clicked', Lang.bind(this, function() {
            this._app.open_new_window(-1);
            appsMenuButton.menu.close();
        }));
        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));
    },
    _onButtonRelease: function(actor, event){
        let button = event.get_button();
        if (button == 3) {
            if ( this._confirmDialog == null ) {
                this._confirmDialog = new confirmDialog(this._app);
            }
            this._confirmDialog.open();
        }
    },
    _onDestroy : function() {
        if (this._clickEventId) this.actor.disconnect(this._clickEventId);
        if (this._releaseEventId) this.actor.disconnect(this._releaseEventId);
    }
};
Signals.addSignalMethods(FavoritesButton.prototype);

function ConfigManager(parent) {
    this._init(parent);
}
ConfigManager.prototype = {
    _init: function(parent) {
        this._conf = {};
        this.parent = parent;
    },
    get_val: function(key, defaultValue) {
        return (this._conf[key]==undefined)?defaultValue:this._conf[key];
    },
    get_enum: function(key, defaultValue) {
        let res;
        try {
            res = this._conf[key].split(',');
        } catch (e) {
            res = defaultValue;
        }
        return res;
    },
    set_val: function(key,value) {
        this._conf[key] = value;
    },
    implode:function( glue, pieces ) {
        return ( ( pieces instanceof Array ) ? pieces.join ( glue ) : pieces );
    },
    loadConfig: function() {
        this.display_activites = true;
        this.activites_position = false;
        this.defaultFavColumns = global.settings.get_strv('favorite-apps').length>12?3:2;
        this.button_label ='';
        this.display_icon = true;
        this.icon_name = 'start-here';
        this.parent._icon.set_icon_name(this.icon_name);
        this.start_with_fav = false;
        if(!this.display_icon)
            this.parent._iconBox.hide();
        else
            this.parent._iconBox.show();
        if(this.button_label!=''){
            this.parent._label.set_text(this.button_label);
            this.parent._label.show();
        }else{
            this.parent._label.hide();
        }
        this.main_icon_size = 14;
        this.parent._icon.set_icon_size(this.main_icon_size);
        this.main_box_width = 705;
        this.favorites_text = true;
        this.favorites_columns = this.defaultFavColumns;
        this.favorites_icon_size = 22;
        this.category_with_scroll = false
        this.category_icon_size = 22;
        this.leftpane_icon_size = 22;
        this.application_icon_size = 22;
        this.categories_box_width = 180;
        this.smart_height = false;
        this.click_on_category = false;
        this.searchentry_width = this.get_val('searchentry_width', 240);
    },
    destroy: function() {

    }
};

function ToggleSwitch(state) {
    this._init(state);
}
ToggleSwitch.prototype = {
    __proto__: PopupMenu.Switch.prototype,
    _init: function(state) {
        PopupMenu.Switch.prototype._init.call(this, state);
        this.actor.can_focus = true;
        this.actor.reactive = true;
        this.actor.add_style_class_name("config-menu-toggle-switch");
        this.actor.connect('button-release-event', Lang.bind(this, this._onButtonReleaseEvent));
        this.actor.connect('key-press-event', Lang.bind(this, this._onKeyPressEvent));
        this.actor.connect('key-focus-in', Lang.bind(this, this._onKeyFocusIn));
        this.actor.connect('key-focus-out', Lang.bind(this, this._onKeyFocusOut));
    },
    _onButtonReleaseEvent: function(actor, event) {
        this.toggle();
        return true;
    },
    _onKeyPressEvent: function(actor, event) {
        let symbol = event.get_key_symbol();
        if (symbol == Clutter.KEY_space || symbol == Clutter.KEY_Return) {
            this.toggle();
            return true;
        }
        return false;
    },
    _onKeyFocusIn: function(actor) {
        actor.add_style_pseudo_class('active');
    },
    _onKeyFocusOut: function(actor) {
        actor.remove_style_pseudo_class('active');
    },
    getState: function() {
        return this.state;
    }
};

function AxeButton(menuAlignment) {
    this._init(menuAlignment);
}
AxeButton.prototype = {
    __proto__: PanelMenu.SystemStatusButton.prototype,
    _init: function(menuAlignment) {
        PanelMenu.ButtonBox.prototype._init.call(this, { reactive: true, can_focus: true, track_hover: true });
	let icon = new St.Icon({ icon_size: 14, icon_name: 'start-here-symbolic'  }); 
        this.actor.add_actor(icon);
        this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPress));
        this.actor.connect('key-press-event', Lang.bind(this, this._onSourceKeyPress));
        this._menuAlignment = menuAlignment;
        this._resetMenu();
        if(ShellVersion[1]<4){
            //gconftool-2 -s --type string "/apps/metacity/global_keybindings/run_command_12" 'Super_R'
            global.window_manager.takeover_keybinding('run_command_12');
            this._keyBindingId = global.window_manager.connect('keybinding::run_command_12', function() {
                appsMenuButton.toggleMenu();
            });
        }else{
            global.display.add_keybinding('axemenu-toggle', this._getSettings(), 0, function() {
                appsMenuButton.toggleMenu();
            });
        }
    },
    _getSettings: function() {
        let source = Gio.SettingsSchemaSource.new_from_directory(extensionMeta.path+"/schemas", Gio.SettingsSchemaSource.get_default(), false);
        let schema = source.lookup('org.gnome.shell.extensions.axemenu.keybindings', false);
        return new Gio.Settings({settings_schema: schema});
    },
    toggleMenu: function(){
        if (!this.menu.isOpen) {
            let monitor = Main.layoutManager.primaryMonitor;
            this.menu.actor.style = ('max-height: ' + Math.round(monitor.height - Main.panel.actor.height-80) + 'px;');
        }
        this.menu.toggle();
    },
    _resetMenu: function(){
        this.menu = new PopupMenu.PopupMenu(this.actor, this._menuAlignment, St.Side.TOP);
        this.menu.actor.add_style_class_name('application-menu-background');
        this.menu.connect('open-state-changed', Lang.bind(this, this._onOpenStateChanged));
        Main.uiGroup.add_actor(this.menu.actor);
        this.menu.actor.hide();
	Main.panel.addToStatusArea('apps-menu', this, 0, 'left');
    },
    _onButtonPress: function(actor, event) {
        let button = event.get_button();
        if (button == 1) {
            this.toggleMenu();
        }
    },
    _onSourceKeyPress: function(actor, event) {
        let symbol = event.get_key_symbol();
        if (symbol == Clutter.KEY_space || symbol == Clutter.KEY_Return) {
            this.menu.toggle();
            return true;
        } else if (symbol == Clutter.KEY_Escape && this.menu.isOpen) {
            this.menu.close();
            return true;
        } else if (symbol == Clutter.KEY_Down) {
            if (!this.menu.isOpen)
                this.menu.toggle();
            this.menu.actor.navigate_focus(this.actor, Gtk.DirectionType.DOWN, false);
            return true;
        } else
            return false;
    },
    _onOpenStateChanged: function(menu, open) {
        if (open)
            this.actor.add_style_pseudo_class('active');
        else
            this.actor.remove_style_pseudo_class('active');
    },
    destroy: function() {
        this.actor._delegate = null;
        this._monitor.disconnect(this._monitorChangedId);
        this.menu.actor.get_children().forEach(function(c) { c.destroy() });
        this.menu.destroy();
        if(ShellVersion[1]<4)
            global.window_manager.disconnect(this._keyBindingId);
        else
            global.display.remove_keybinding('axemenu-toggle');
        this.actor.destroy();
    }
};
Signals.addSignalMethods(AxeButton.prototype);

function ApplicationsButton() {
    this._init();
}
ApplicationsButton.prototype = {
    __proto__: AxeButton.prototype,
    _init: function() {
    	AxeButton.prototype._init.call(this, 1);
        let container = new Shell.GenericContainer();
        container.connect('get-preferred-width', Lang.bind(this, this._containerGetPreferredWidth));
        container.connect('get-preferred-height', Lang.bind(this, this._containerGetPreferredHeight));
        this.actor.add_actor(container);
        this._box = new St.BoxLayout({ name: 'axeMenu' });
        this._iconBox = new St.Bin();
        this._box.add(this._iconBox, { y_align: St.Align.MIDDLE, y_fill: false });
        this._icon = new St.Icon({ icon_name: 'start-here', icon_size: 16, style_class: 'axemenu-icon' });
        this._iconBox.child = this._icon;
        this._label = new St.Label({ track_hover: true, style_class: 'application-menu-button-label'});
        this._box.add(this._label, { y_align: St.Align.MIDDLE, y_fill: false });
        this._label.set_text("Menu");
        container.add_actor(this._box);
        this._searchInactiveIcon = new St.Icon({ style_class: 'search-entry-icon', icon_name: 'edit-find' });
        this._searchActiveIcon = new St.Icon({ style_class: 'search-entry-icon', icon_name: 'edit-clear' });
        this._searchTimeoutId = 0;
        this._searchIconClickedId = 0;
        this._selectedItemIndex = null;
        this._favSelectedItemIndex = null;
        this._previousSelectedItemIndex = null;
        this._activeContainer = null;
        this.cm = new ConfigManager(this);
        this._createLayout();
        this._display();
        _installedChangedId = appsys.connect('installed-changed', Lang.bind(this, this.reDisplay));
        _favoritesChangedId = AppFavorites.getAppFavorites().connect('changed', Lang.bind(this, this.reDisplay));
        this.menu.connect('open-state-changed', Lang.bind(this, this._onOpenStateToggled));
    },
    _containerGetPreferredWidth: function(actor, forHeight, alloc) {
        [alloc.min_size, alloc.natural_size] = this._box.get_preferred_width(forHeight);
    },
    _containerGetPreferredHeight: function(actor, forWidth, alloc) {
        [alloc.min_size, alloc.natural_size] = this._box.get_preferred_height(forWidth);
    },
    _onRepaintSeparator: function(area){
        let cr = area.get_context();
        let themeNode = area.get_theme_node();
        let [width, height] = area.get_surface_size();
        let margin = themeNode.get_length('-margin-horizontal');
        let gradientHeight = themeNode.get_length('-gradient-height');
        let startColor = themeNode.get_color('-gradient-start');
        let endColor = themeNode.get_color('-gradient-end');
        let gradientWidth = (width - margin * 2);
        let gradientOffset = (height - gradientHeight) / 2;
        let pattern = new Cairo.LinearGradient(margin, gradientOffset, width - margin, gradientOffset + gradientHeight);
        pattern.addColorStopRGBA(0, startColor.red / 255, startColor.green / 255, startColor.blue / 255, startColor.alpha / 255);
        pattern.addColorStopRGBA(0.5, endColor.red / 255, endColor.green / 255, endColor.blue / 255, endColor.alpha / 255);
        pattern.addColorStopRGBA(1, startColor.red / 255, startColor.green / 255, startColor.blue / 255, startColor.alpha / 255);
        cr.setSource(pattern);
        cr.rectangle(margin, gradientOffset, gradientWidth, gradientHeight);
        cr.fill();
    },
    _onMenuKeyPress: function(actor, event) {
        let symbol = event.get_key_symbol();
        if(symbol == Clutter.KEY_Super_R) {
            this.menu.close();
            return true;
        }
        if(symbol == Clutter.KEY_Tab) {
            this.favoritesSwith.emit('clicked',1);
            return true;
        }
        if (this._activeContainer === null && symbol == Clutter.KEY_Up) {
            this._activeContainer = this.applicationsBox;
            children = this._activeContainer.get_children();
            this._selectedItemIndex = children.length;
        } else if (this._activeContainer === null && symbol == Clutter.KEY_Down) {
            this._activeContainer = this.applicationsBox;
            children = this._activeContainer.get_children();
            this._selectedItemIndex = -1;
        }else if (this._activeContainer === null) {
            this._activeContainer = this.categoriesBox;
            this._selectedItemIndex = -1;
            this._previousSelectedItemIndex = -1;
        }else if (this._activeContainer == this.favoritesTable) {
            this._favSelectedItemIndex = this._favSelectedItemIndex===null?-1:this._favSelectedItemIndex;
            children = this._activeContainer.get_children();
        }
        let children = this._activeContainer.get_children();
        if (children.length==0){
            this._activeContainer = this.categoriesBox;
            this._selectedItemIndex = -1;
            this._previousSelectedItemIndex = -1;
            children = this._activeContainer.get_children();
        }
        if(this._activeContainer != this.favoritesTable) {
            let index = this._selectedItemIndex;
            if (symbol == Clutter.KEY_Up) {
                index = this._selectedItemIndex - 1 < 0 ? 0 : this._selectedItemIndex - 1;
            } else if (symbol == Clutter.KEY_Down) {
                index = this._selectedItemIndex + 1 == children.length ? children.length - 1 : this._selectedItemIndex + 1;
            } else if (symbol == Clutter.KEY_Right && this._activeContainer === this.categoriesBox) {
                this._activeContainer = this.applicationsBox;
                children = this._activeContainer.get_children();
                index = 0;
                this._previousSelectedItemIndex = this._selectedItemIndex;
                this._selectedItemIndex = -1;
            } else if (symbol == Clutter.KEY_Left && this._activeContainer === this.applicationsBox) {
                this._clearSelections(this.applicationsBox);
                this._activeContainer = this.categoriesBox;
                children = this._activeContainer.get_children();
                index = this._previousSelectedItemIndex;
                this._selectedItemIndex = -1;
            } else if (this._activeContainer === this.applicationsBox && (symbol == Clutter.KEY_space || symbol == Clutter.KEY_Return || symbol == Clutter.KP_Enter)) {
                let item_actor = children[this._selectedItemIndex];
                item_actor.emit('clicked', 1);
                return true;
            } else {
                return false;
            }
            if (index == this._selectedItemIndex) {
                return true;
            }
            if (index>=children.length) index = children.length-1;
            this._selectedItemIndex = index;

            let item_actor = children[this._selectedItemIndex];
            if (!item_actor || item_actor === this.searchEntry) {
                return false;
            }
            if(!item_actor._delegate) {
                if(symbol == Clutter.KEY_Down){
                    ++this._selectedItemIndex;
                    item_actor = children[this._selectedItemIndex];
                }else if(symbol == Clutter.KEY_Up){
                    --this._selectedItemIndex;
                    item_actor = children[this._selectedItemIndex];
                }
            }
            if(this._activeContainer === this.categoriesBox && this.cm.click_on_category)
                item_actor.emit('clicked', 1);
            else
                item_actor._delegate.emit('enter-event');
        }else{
            let index = this._favSelectedItemIndex;
            if (symbol == Clutter.KEY_Up || symbol == Clutter.KEY_Left) {
                index = this._favSelectedItemIndex - 1 < 0 ? 0 : this._favSelectedItemIndex - 1;
            } else if (symbol == Clutter.KEY_Down || symbol == Clutter.KEY_Right) {
                index = this._favSelectedItemIndex + 1 == children.length ? children.length - 1 : this._favSelectedItemIndex + 1;
            } else if (this._favSelectedItemIndex>=0 && (symbol == Clutter.KEY_space || symbol == Clutter.KEY_Return || symbol == Clutter.KP_Enter)) {
                let item_actor = children[this._favSelectedItemIndex];
                item_actor.emit('clicked', 1);
                return true;
            } else {
                return false;
            }
            if (index == this._favSelectedItemIndex) {
                return true;
            }
            if (index>=children.length) index = children.length-1;
            this._favSelectedItemIndex = index;
            let item_actor = children[this._favSelectedItemIndex];
            if (!item_actor || item_actor === this.searchEntry) {
                return false;
            }
            item_actor._delegate.emit('enter-event');
        }
        return true;
    },
    _addEnterEvent: function(button, callback) {
        let _callback = Lang.bind(this, function() {
            let parent = button.actor.get_parent();
            if (this._activeContainer === this.categoriesBox && parent !== this._activeContainer) {
                this._previousSelectedItemIndex = this._selectedItemIndex;
            }
            this._activeContainer = parent;
            let children = this._activeContainer.get_children();
            for (let i=0, l=children.length; i<l; i++) {
                if (button.actor === children[i]) {
                    this._selectedItemIndex = i;
                }
            };
            callback();
        });
        button.connect('enter-event', _callback);
        button.actor.connect('enter-event', _callback);
    },
    _addFavEnterEvent: function(button, callback) {
        let _callback = Lang.bind(this, function() {
            let children = this._activeContainer.get_children();
            for (let i=0, l=children.length; i<l; i++) {
                if (button.actor === children[i]) {
                    this._favSelectedItemIndex = i;
                }
            };
            callback();
        });
        button.connect('enter-event', _callback);
        button.actor.connect('enter-event', _callback);
    },
    _clearSelections: function(container) {
        container.get_children().forEach(function(actor) {
        if(actor.style_class != 'popup-separator-menu-item')
            actor.style_class = "category-button";
        });
    },
    _clearFavSelections: function() {
        this.favoritesTable.get_children().forEach(function(actor) {
            actor.remove_style_pseudo_class('hover');
        });
    },
    _onOpenStateToggled: function(menu, open) {
       if (open) {
           this.resetSearch();
           this._selectedItemIndex = null;
           this._favSelectedItemIndex = null;
           this._clearFavSelections();
           
           if(this.cm.start_with_fav){
               this.favoritesBox.show();
               this.categoriesApplicationsBox.hide();
               this.favoritesSwith.set_label("All applications");
               this._activeContainer = this.favoritesTable;
           }else{
               this.favoritesBox.hide();
               this.categoriesApplicationsBox.show();
               this.favoritesSwith.set_label("Favorites");
               this._activeContainer = null;
           }
           this.selectedAppTitle.set_text("");
           this.selectedAppDescription.set_text("");
       }
       AxeButton.prototype._onOpenStateChanged.call(menu, open);
    },
    reDisplay : function() {
        this._cleanControls();
        this._display();
    },
    _cleanControls: function(){
        cleanActor(this.favoritesTable);
        cleanActor(this.categoriesBox);
        cleanActor(this.applicationsBox);
    },
    _loadCategory: function(dir) {
        var iter = dir.iter();
        var nextType;
        while ((nextType = iter.next()) != GMenu.TreeItemType.INVALID) {
            if (nextType == GMenu.TreeItemType.ENTRY) {
                var entry = iter.get_entry();
                if (!entry.get_app_info().get_nodisplay()) {
                    var app = appsys.lookup_app_by_tree_entry(entry);
                    if (!this.applicationsByCategory[dir.get_menu_id()]) this.applicationsByCategory[dir.get_menu_id()] = new Array();
                    this.applicationsByCategory[dir.get_menu_id()].push(app);
                }
            } else if (nextType == GMenu.TreeItemType.DIRECTORY) {
                let subdir = iter.get_directory();
                if (subdir.get_is_nodisplay()) continue;
                this.applicationsByCategory[subdir.get_menu_id()] = new Array();
                this._loadCategory(subdir);
                if (this.applicationsByCategory[subdir.get_menu_id()].length>0){
                   let categoryButton = new CategoryButton(this,subdir,this.cm.category_icon_size);
                   this.categoriesBox.add_actor(categoryButton.actor);
                }
            }
        }
    },
    _scrollToButton: function(button) {
        var current_scroll_value = this.applicationsScrollBox.get_vscroll_bar().get_adjustment().get_value();
        var box_height = this.applicationsScrollBox.get_allocation_box().y2-this.applicationsScrollBox.get_allocation_box().y1;
        var new_scroll_value = current_scroll_value;
        if (current_scroll_value > button.actor.get_allocation_box().y1-10) new_scroll_value = button.actor.get_allocation_box().y1-10;
        if (box_height+current_scroll_value < button.actor.get_allocation_box().y2+10) new_scroll_value = button.actor.get_allocation_box().y2-box_height+10;
        if (new_scroll_value!=current_scroll_value) this.applicationsScrollBox.get_vscroll_bar().get_adjustment().set_value(new_scroll_value);
    },
    _scrollToCatButton: function(button) {
        var current_scroll_value = this.categoriesScrollBox.get_vscroll_bar().get_adjustment().get_value();
        var box_height = this.categoriesScrollBox.get_allocation_box().y2-this.categoriesScrollBox.get_allocation_box().y1;
        var new_scroll_value = current_scroll_value;
        if (current_scroll_value > button.actor.get_allocation_box().y1-10) new_scroll_value = button.actor.get_allocation_box().y1-10;
        if (box_height+current_scroll_value < button.actor.get_allocation_box().y2+10) new_scroll_value = button.actor.get_allocation_box().y2-box_height+10;
        if (new_scroll_value!=current_scroll_value) this.categoriesScrollBox.get_vscroll_bar().get_adjustment().set_value(new_scroll_value);
    },
    _createLayout: function() {
        let section = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(section);
        this.favoritesBox = new St.BoxLayout({ style_class: 'applications-menu-favorites-box', vertical: true });
        this.favoritesTable = new St.Table({ homogeneous: true, reactive: true, style_class: 'applications-menu-favorites-table' });
        this.rightPane = new St.BoxLayout({ style_class: 'rightpane-box', vertical: true });
        this.searchBox = new St.BoxLayout({ style_class: 'search_box' });
        this.rightPane.add_actor(this.searchBox);
        this.searchEntry = new St.Entry({ name: 'searchEntry', hint_text: "Type to search...", track_hover: true, can_focus: true });
        this.searchEntry.set_secondary_icon(this._searchInactiveIcon);
        this.searchBox.add_actor(this.searchEntry);
        this.searchEntryText = this.searchEntry.clutter_text;
        this.searchEntryText.connect('text-changed', Lang.bind(this, this._onSearchTextChanged));
        this.searchEntryText.connect('key-press-event', Lang.bind(this, this._onMenuKeyPress));
        this._buttonLayout = new St.BoxLayout({ style_class: 'favorites-button-box', vertical: false });
        this.favoritesSwith = new St.Button({ style_class: 'modal-dialog-button favswich-button', reactive: true, can_focus: false,
                                                label: "All applications" });
        this._buttonLayout.add(this.favoritesSwith, { expand: true, x_fill: false, y_fill: false, x_align: St.Align.END, y_align: St.Align.MIDDLE });
        this.searchBox.add(this._buttonLayout, { expand:  true, x_align: St.Align.END, y_align: St.Align.MIDDLE });
        this.favoritesSwith.connect('clicked', Lang.bind(this, function() {
            if (this.favoritesBox.visible){
                this.favoritesBox.hide();
                this._activeContainer = null;
                this.categoriesApplicationsBox.show();
                this.favoritesSwith.set_label("Favorites");
                
            }else{
                this.favoritesBox.show();
                this.selectedAppTitle.set_text("");
                this.selectedAppDescription.set_text("");
                this._activeContainer = this.favoritesTable;
                this.categoriesApplicationsBox.hide();
                this.favoritesSwith.set_label("All applications");
            }
            this.selectedAppTitle.set_text("");
            this.selectedAppDescription.set_text("");
        }));
        this.categoriesApplicationsBox = new St.BoxLayout({ style_class: 'categories-app-box'});
        this.rightPane.add(this.categoriesApplicationsBox, { expand: true,x_fill: true,y_fill: true });
        this.categoriesBox = new St.BoxLayout({ style_class: 'categories-box', vertical: true });
        this.applicationsScrollBox = new St.ScrollView({ x_fill: true, y_fill: false, y_align: St.Align.START, style_class: 'vfade applications-scrollbox' });
        let vscroll = this.applicationsScrollBox.get_vscroll_bar();
        vscroll.connect('scroll-start', Lang.bind(this, function() {
                              this.menu.passEvents = true;
                          }));
        vscroll.connect('scroll-stop', Lang.bind(this, function() {
                              this.menu.passEvents = false;
                          }));
        this.categoriesScrollBox = new St.ScrollView({ x_fill: true, y_fill: false, y_align: St.Align.START, style_class: 'vfade categories-scrollbox' });
        vscroll = this.categoriesScrollBox.get_vscroll_bar();
        vscroll.connect('scroll-start', Lang.bind(this, function() {
                              this.menu.passEvents = true;
                          }));
        vscroll.connect('scroll-stop', Lang.bind(this, function() {
                              this.menu.passEvents = false;
                          }));
        this.applicationsBox = new St.BoxLayout({ style_class: 'applications-box', vertical:true });
        this.applicationsScrollBox.add_actor(this.applicationsBox);
        this.categoriesScrollBox.add_actor(this.categoriesBox, { expand: true,x_fill: false });
        this.applicationsScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        this.categoriesApplicationsBox.add(this.categoriesScrollBox, { expand: false,x_fill: true,y_fill: false, y_align: St.Align.START });
        this.categoriesApplicationsBox.add(this.applicationsScrollBox, { expand: true,x_fill: true,y_fill: true });
        this.mainBox = new St.BoxLayout({ style_class: 'main-box', vertical:false });
        this.favoritesBox.add_actor(this.favoritesTable);
        this.rightPane.add_actor(this.favoritesBox, { expand: true,x_fill: false,y_fill: false });
        this.mainBox.add(this.rightPane, { expand: true,x_fill: true,y_fill: true });
        section.actor.add_actor(this.mainBox);
        this.selectedAppBox = new St.BoxLayout({ style_class: 'selected-app-box', vertical: true });
        this.selectedAppTitle = new St.Label({ style_class: 'selected-app-title', text: "" });
        this.selectedAppBox.add_actor(this.selectedAppTitle);
        this.selectedAppDescription = new St.Label({ style_class: 'selected-app-description', text: "" });
        this.selectedAppBox.add_actor(this.selectedAppDescription);
        this.settingsAndselectedAppBox = new St.BoxLayout();
       // this.settingsAndselectedAppBox.add(this._createSettingsButton(), { expand: false,x_fill: false,y_fill: false, y_align: St.Align.END });
        this.settingsAndselectedAppBox.add(this.selectedAppBox, { expand: true,x_fill: true,y_fill: true });
        section.actor.add_actor(this.settingsAndselectedAppBox);
    },
    _display : function() {
        this.cm.loadConfig();
        this._activeContainer = null;
        this._applicationsButtons = new Array();
        this.categoriesScrollBox.style=('width: '+this.cm.categories_box_width+'px;');
        this.mainBox.style=('width: '+this.cm.main_box_width+'px;');
        this.searchActive = false;
        this.searchEntry.width = this.cm.searchentry_width;
        this._previousSearchPattern = "";
        this.categoriesApplicationsBox.hide();

        //Load favorites
        let launchers = global.settings.get_strv('favorite-apps');
        let appSys = Shell.AppSystem.get_default();
        let j = 0;
        let column=0;
        let rownum=0;
        for ( let i = 0; i < launchers.length; ++i ) {
        let app = appSys.lookup_app(launchers[i]);
            if (app) {
                let button = new FavoritesButton(app,this.cm.favorites_icon_size,this.cm.favorites_text);
                this.favoritesTable.add(button.actor, { row: rownum, col: column });
                this._addFavEnterEvent(button, Lang.bind(this, function() {
                   this.selectedAppTitle.set_text(button._app.get_name());
                   if (button._app.get_description()) this.selectedAppDescription.set_text(button._app.get_description());
                   else this.selectedAppDescription.set_text("");
                   this._clearFavSelections();
                   button.actor.add_style_pseudo_class('hover');
                }));
                button.actor.connect('leave-event', Lang.bind(this, function() {
                   this.selectedAppTitle.set_text("");
                   this.selectedAppDescription.set_text("");
                }));
                ++j;
                ++column;
                if(column==this.cm.favorites_columns){
                    column=0;
                    ++rownum;
                }
            }
        }
        //Load categories
        this.applicationsByCategory = {};
        let tree = appsys.get_tree();
        let root = tree.get_root_directory();
        let iter = root.iter();
        let nextType;
        while ((nextType = iter.next()) != GMenu.TreeItemType.INVALID) {
            if (nextType == GMenu.TreeItemType.DIRECTORY) {
                let dir = iter.get_directory();
                if (dir.get_is_nodisplay()) continue;
                this.applicationsByCategory[dir.get_menu_id()] = new Array();
                this._loadCategory(dir);
                if (this.applicationsByCategory[dir.get_menu_id()].length>0){
                   let categoryButton = new CategoryButton(this,dir,this.cm.category_icon_size);
                   this.categoriesBox.add_actor(categoryButton.actor);
                }
            }
        }
        //Load applications
        this._displayButtons(this._listApplications(null));
        let smartHeight;
        if(this.cm.smart_height){
            let catHeight = this.categoriesBox.height+45;
            if(this.cm.category_with_scroll)
                catHeight = 0;
            smartHeight = Math.max(this.favoritesBox.height+20,catHeight)+20+'px;';
        }else{
            smartHeight = 'auto;';
        }
        this.mainBox.style+=('height: '+smartHeight);
    },
    _clearApplicationsBox: function(selectedActor){
        let actors = this.applicationsBox.get_children();
        for (var i=0; i<actors.length; i++) {
            let actor = actors[i];
            this.applicationsBox.remove_actor(actor);
        }
        let actors = this.categoriesBox.get_children();
        for (var i=0; i<actors.length; i++){
            let actor = actors[i];
            if(actor.style_class != "popup-separator-menu-item")
                if (actor==selectedActor) actor.style_class = "category-button-selected";
                else actor.style_class = "category-button";
        }
    },
     _select_category : function(dir, categoryButton) {
       this.resetSearch();
       this._clearApplicationsBox(categoryButton.actor);
       if (dir) this._displayButtons(this._listApplications(dir.get_menu_id()));
       else this._displayButtons(this._listApplications(null));
    },
    _displayButtons: function(apps){
         if (apps){
            for (var i=0; i<apps.length; i++) {
               let app = apps[i];
               if (!this._applicationsButtons[app]){
                  let applicationButton = new ApplicationButton(app,this.cm.application_icon_size);
                  applicationButton.actor.connect('leave-event', Lang.bind(this, function() {
                     this.selectedAppTitle.set_text("");
                     this.selectedAppDescription.set_text("");
                  }));
                  this._addEnterEvent(applicationButton, Lang.bind(this, function() {
                      this.selectedAppTitle.set_text(applicationButton.app.get_name());
                      if (applicationButton.app.get_description()) this.selectedAppDescription.set_text(applicationButton.app.get_description());
                      else this.selectedAppDescription.set_text("");
                      this._clearSelections(this.applicationsBox);
                      applicationButton.actor.style_class = "category-button-selected";
                      this._scrollToButton(applicationButton);
                  }));
                  this._applicationsButtons[app] = applicationButton;
               }
               this.applicationsBox.add_actor(this._applicationsButtons[app].actor);
            }
         }
    },
    resetSearch: function(){
        this.searchEntry.set_text("");
        this.searchActive = false;
        global.stage.set_key_focus(this.searchEntry);
     },
     _onSearchTextChanged: function (se, prop) {
     this._clearApplicationsBox();
        this.searchActive = this.searchEntry.get_text() != '';
        if (this.searchActive) {
            this._clearSelections(this.categoriesBox);
            this._clearSelections(this.applicationsBox);
            this.favoritesBox.hide();
            this._activeContainer = null;
            this.categoriesApplicationsBox.show();
            this.favoritesSwith.set_label(_("Favorites"));
            this.searchEntry.set_secondary_icon(this._searchActiveIcon);
            if (this._searchIconClickedId == 0) {
                this._searchIconClickedId = this.searchEntry.connect('secondary-icon-clicked',
                    Lang.bind(this, function() {
                        this.resetSearch();
                    }));
            }
        } else {
            if (this._searchIconClickedId > 0)
                this.searchEntry.disconnect(this._searchIconClickedId);
            this._searchIconClickedId = 0;
            this.searchEntry.set_secondary_icon(this._searchInactiveIcon);
        }
        if (!this.searchActive) {
            if (this._searchTimeoutId > 0) {
                Mainloop.source_remove(this._searchTimeoutId);
                this._searchTimeoutId = 0;
            }
            return;
        }
        if (this._searchTimeoutId > 0)
            return;
        this._searchTimeoutId = Mainloop.timeout_add(150, Lang.bind(this, this._doSearch));
    },
    _listApplications: function(category_menu_id, pattern){
       var applist;
       if (category_menu_id) applist = this.applicationsByCategory[category_menu_id];
       else{
          applist = new Array();
          if (pattern) {
          for (var c in this.applicationsByCategory) {
          	for (var i in this.applicationsByCategory[c]) {
          		applist.push(this.applicationsByCategory[c][i]);
          	}
          }
          }
       }
       var res;
       if (pattern){
          res = new Array();
          for (var i in applist){
             let app = applist[i];
             if (app.get_name().toLowerCase().indexOf(pattern)!=-1 || (app.get_description() && app.get_description().toLowerCase().indexOf(pattern)!=-1)) res.push(app);
          }
       }else res = applist;
       res.sort(function(a,b){
          return a.get_name().toLowerCase() > b.get_name().toLowerCase();
       });
       return res;
    },
    _doSearch: function(){
       this._searchTimeoutId = 0;
       let pattern = this.searchEntryText.get_text().replace(/^\s+/g, '').replace(/\s+$/g, '').toLowerCase();
       if (pattern==this._previousSearchPattern) return false;
       this._previousSearchPattern = pattern;
       this._activeContainer = null;
       this._selectedItemIndex = null;
       this._previousSelectedItemIndex = null;
       if (pattern.length == 0) {
           this._clearApplicationsBox();
           return false;
       }
       var appResults = this._listApplications(null, pattern);
       this._clearApplicationsBox();
       this._displayButtons(appResults);
       let actors = this.applicationsBox.get_children();
       if(actors[0])
            actors[0]._delegate.emit('enter-event');
       return false;
    }
};

let appsMenuButton;
let _installedChangedId;
let _favoritesChangedId;
let extensionMeta,egoVersion;

function enable() {
    appsMenuButton = new ApplicationsButton();
    insert_actor_to_box(Main.panel._leftBox,appsMenuButton.actor, 1);
    Main.panel._axeMenu = appsMenuButton;
    /*Main.panel.statusArea.appMenu.actor.destroy();
    Main.panel.statusArea['appMenu'] = null;
    let indicator = new Panel.AppMenuButton(Main.panel);
    Main.panel.addToStatusArea('appMenu',indicator, 1, 'left');*/
}

function disable() {
    Main.panel._leftBox.remove_actor(appsMenuButton.actor);
    appsys.disconnect(_installedChangedId);
    AppFavorites.getAppFavorites().disconnect(_favoritesChangedId);
    appsMenuButton.destroy();
}

function init(metadata) {
    extensionMeta = metadata;
    egoVersion = ShellVersion[1]<4?metadata.version:metadata.metadata['version'];
}
