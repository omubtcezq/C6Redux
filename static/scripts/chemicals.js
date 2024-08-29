//# sourceURL=chemicals.js
(function() {
// Load once document is ready
$(document).ready(function() {

// Set up banner subpage buttons
subpages = [{
    button_id: "chemical-list-subpage-button",
    content_id: "chemical-list-subpage",
    content_html: "chemical_list.html",
    click_on_init: true
}, {
    button_id: "phcurves-subpage-button",
    content_id: "phcurves-subpage",
    content_html: "phcurves.html",
    click_on_init: false
}];
init_subpage_buttons(subpages);

});
})();