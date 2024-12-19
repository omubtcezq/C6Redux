//# sourceURL=screen_editor.js
site_functions.CONTENT_PROVIDERS.screen_editor = (function() {

// ========================================================================== //
// Publicly accessible functions go here (note script needs to be loaded for them to be available)
// ========================================================================== //

var public_functions = {};
public_functions.screen_query = function (query_object){
    hide_screen();
    let screen_table = Tabulator.findTable('#screen-tabulator')[0];
    screen_table.setData(site_functions.API_URL+'/screens/query', query_object, "POST");
    LAST_QUERY = query_object;
    screen_table.showColumn('well_match_counter');
    screen_table.setSort([
        {column:"screen.name", dir:"asc"},
        {column:"well_match_counter", dir:"desc"}
    ]);
}

// ========================================================================== //
// Private functions
// ========================================================================== //


// ========================================================================== //
// Actions to perform once document is ready (e.g. create table and event handlers)
// ========================================================================== //

$(document).ready(function() {


// Propagate message passing after tables have loaded
Promise.all([]).then(function(){
    site_functions.propagate_message_passing();
});

});

// Return public functions object for globally avilable functions
return public_functions;
})();