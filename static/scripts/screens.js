//# sourceURL=screens.js
(function() {
// Load once document is ready
$(document).ready(function() {

// Set up banner subpage buttons
subpages = [{
    button_id: "screen-explorer-subpage-button",
    content_id: "screen-explorer-subpage",
    content_html: "screen_explorer.html",
    click_on_init: true
}, {
    button_id: "screen-editor-subpage-button",
    content_id: "screen-editor-subpage",
    content_html: "screen_editor.html",
    click_on_init: false
}, {
    button_id: "recipes-subpage-button",
    content_id: "recipes-subpage",
    content_html: "recipes.html",
    click_on_init: false
}, {
    button_id: "selected-wells-subpage-button",
    content_id: "selected-wells-subpage",
    content_html: "selected_wells.html",
    click_on_init: false
}];
init_subpage_buttons(subpages);

});
})();