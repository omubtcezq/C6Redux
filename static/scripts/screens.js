//# sourceURL=screens.js
(function() {
// Load once document is ready
$(document).ready(function() {

// Set up banner subpage buttons
subpages = [{
    content_name: "screen_explorer",
    button_id: "screen-explorer-subpage-button",
    content_id: "screen-explorer-subpage",
    content_html: "screen_explorer.html",
    click_on_init: true
}, {
    content_name: "screen_editor",
    button_id: "screen-editor-subpage-button",
    content_id: "screen-editor-subpage",
    content_html: "screen_editor.html",
    click_on_init: false
}, {
    content_name: "selected_wells",
    button_id: "selected-wells-subpage-button",
    content_id: "selected-wells-subpage",
    content_html: "selected_wells.html",
    click_on_init: false
}];
site_functions.init_subpage_buttons("screens", subpages);

// Propagate message passing after everything loaded
site_functions.propagate_message_passing();

});
})();