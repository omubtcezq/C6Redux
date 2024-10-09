//# sourceURL=chemicals.js
(function() {
// Load once document is ready
$(document).ready(function() {

// Set up banner subpage buttons
subpages = [{
    content_name: "chemical_list",
    button_id: "chemical-list-subpage-button",
    content_id: "chemical-list-subpage",
    content_html: "chemical_list.html",
    click_on_init: true
}, {
    content_name: "phcurves",
    button_id: "phcurves-subpage-button",
    content_id: "phcurves-subpage",
    content_html: "phcurves.html",
    click_on_init: false
}];
site_functions.init_subpage_buttons("chemicals", subpages);

// Propagate message passing after everything loaded
site_functions.propagate_message_passing();

});
})();