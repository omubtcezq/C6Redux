(function() {
// Connection parameters
API_IP = '13.236.58.27'
//API_IP = 'localhost'
API_PORT = '8000'
API_URL = 'http://'+API_IP+':'+API_PORT+'/api'

// Load rest once document is ready
$(document).ready(function() {

/*
 
  ######   ##        #######  ########     ###    ##        ######  
 ##    ##  ##       ##     ## ##     ##   ## ##   ##       ##    ## 
 ##        ##       ##     ## ##     ##  ##   ##  ##       ##       
 ##   #### ##       ##     ## ########  ##     ## ##        ######  
 ##    ##  ##       ##     ## ##     ## ######### ##             ## 
 ##    ##  ##       ##     ## ##     ## ##     ## ##       ##    ## 
  ######   ########  #######  ########  ##     ## ########  ######  
 
*/

let CONDITION_ID_COUNTER = 0;
let CHEMICAL_ID_COUNTER = 0;

let SCREEN_QUERY = {
    'name_search': null,
    'owner_search': null,
    'conds': null
};
let SCREEN_NAMES = null;
let CHEMICAL_NAMES = null;

let ALL_UNITS = [
    'M',
    'v/v',
    'w/v',
    'mM',
    'mg/ml'
]

/*
 
 ########    ###    ########  ##       ########  ######  
    ##      ## ##   ##     ## ##       ##       ##    ## 
    ##     ##   ##  ##     ## ##       ##       ##       
    ##    ##     ## ########  ##       ######    ######  
    ##    ######### ##     ## ##       ##             ## 
    ##    ##     ## ##     ## ##       ##       ##    ## 
    ##    ##     ## ########  ######## ########  ######  
 
*/

// Load all screens button
$('#all-screens').click(function(){
    screen_table_body = $('#screen-table > tbody');
    screen_table_body.empty();
    $.getJSON(API_URL+'/screens/all', function(data) {
        display_screens(data, null);
    });
})

function display_screens(screen_list_data, well_query_string){
    if (screen_list_data.length == 0){
        $('#screen-table > tbody').append(
            $('<tr>').append(
                $('<td>').attr('colspan',9).text('No matching screens found')
            )
        )
    } else {
        $.each(screen_list_data, function(i,d){
            let s = d[0];
            let c = d[1];
            // Add all screen components to row
            $('#screen-table > tbody').append(
                $('<tr>').attr('id','screen-'+s.id).
                append($('<td>').text(s.name)).
                append($('<td>').text(s.owned_by)).
                append($('<td>').text(s.creation_date)).
                append($('<td>').text(s.format_name)).
                append($('<td>').text(s.format_rows)).
                append($('<td>').text(s.format_cols)).
                append($('<td>').text(s.comments)).
                append($('<td>').text(c)).
                // Include button to view the screen calling function defined above
                append(
                    $('<td>').attr('class', 'button-cell').
                    append(
                        $('<button>').attr('id', 'view-screen-button'+s.id).
                        text('View').
                        click(function () {
                            // Load screen contents given id and the screen row
                            load_screen_wells(s.id, well_query_string, $(this).parent().parent());
                        })
                    )
                )
            );
        });
    }
}

// Load screen contents button function
function load_screen_wells(screen_id, well_query_string, row){
    // If screen already viewed, remove it
    if (row.next().attr('id') == 'screen-contents-'+screen_id){
        row.next().remove();
        $('#view-screen-button'+screen_id).text('View');
        row.removeClass('viewed-screen-highlight');
    // If not, get screen contents and display them
    } else {
        if (!well_query_string){
            $.getJSON(API_URL+'/screens/wells?screen_id='+screen_id, function(data){
                display_wells(data, screen_id, row)
            });
        } else {
            $.ajax({
                type: 'POST',
                url: API_URL+'/screens/wellQuery?screen_id='+screen_id, 
                data: well_query_string, 
                // Display returned screens
                success: function(data) {
                    display_wells(data, screen_id, row);
                }, 
                dataType: 'json',
                contentType: 'application/json'
            });
        }
    }
}

function display_wells(well_data, screen_id, row){
    // Create body to append rows to
    let screen_contents_table = $('<tbody>')
    // Loop wells
    $.each(well_data, function(i, w){
        // First row should include cell for well label
        let first = true;
        let contents_row = $('<tr>');
        let num_factors = w.wellcondition.factors.length;
        contents_row.append(
            $('<td>').attr('rowspan', num_factors).
            text(w.label)
        );
        // Loop factors
        $.each(w.wellcondition.factors, function(i, f){
            // If not first row of well create a new one
            if (!first){
                contents_row = $('<tr>');
            }
            // What to display for each factor
            contents_row.
            append($('<td>').text(f.chemical.name)).
            append($('<td>').text(f.concentration)).
            append($('<td>').text(f.unit)).
            append($('<td>').text(f.ph))

            // If first add recipe button cell
            if (first){
                // Include button to generate recipe for condition
                contents_row.append(
                    $('<td>').attr('class', 'button-cell').attr('rowspan', num_factors).
                    append(
                        $('<button>').attr('id', 'generate-condition-recipe-button'+w.wellcondition.id).
                        text('Recipe').
                        click(function () {
                            // Load generated recipe wellcondition id and the condition row
                            generate_recipe(w.wellcondition.id, $(this).parent().parent());
                        })
                    )
                );
            }

            // No longer first
            first = false;
            
            // Add row to contents table
            screen_contents_table.append(contents_row);
        })
        
    })
    // Create row in original table below screen row and add new contents table there
    row.after(
        $('<tr>').
        attr('id', 'screen-contents-'+screen_id).
        attr('class', 'viewed-screen-highlight').
        append(
            $('<td>').attr('colspan', '9')
            .append(
                $('<p>').text('Screens contained in this screen:')
            ).append(
                $('<div>').append(
                    $('<button>').attr('id', 'subset-screens-button-'+screen_id).text('Search')
                    .click(function(){
                        $.getJSON(API_URL+'/screens/subsets?screen_id='+screen_id, function(data){
                            let thead = $('<thead>').append($('<tr>').append(
                                $('<th>').text('Screen name')
                            ).append(
                                $('<th>').text('Owner')
                            ).append(
                                $('<th>').text('Number of wells')
                            ))
                            let tbody = $('<tbody>');
                            if (data.length == 0){
                                tbody.append($('<tr>').append(
                                    $('<td>').attr('colspan', '3').text('No screens found')
                                ));
                            } else {
                                $.each(data, function(i,d){
                                    let s = d[0];
                                    let c = d[1];
                                    tbody.append(
                                        $('<tr>').append(
                                            $('<td>').text(s.name)
                                        ).append(
                                            $('<td>').text(s.owned_by)
                                        ).append(
                                            $('<td>').text(c)
                                        )
                                    );
                                });
                            }
                            $('#subset-screens-button-'+screen_id).parent().empty().append(
                                $('<table>').attr('class', 'screen-contents-table').append(thead).append(tbody)
                            );
                        });
                    })
                )
            ).append(
                $('<p>').text('Relevant Wells:')
            ).append(
                // Contents table
                $('<table>').attr('class', 'screen-contents-table').
                append(
                    $('<thead>').append(
                        $('<tr>').append($('<th>').text('Well')).
                        append($('<th>').text('Chemical')).
                        append($('<th>').text('Concentration')).
                        append($('<th>').text('Units')).
                        append($('<th>').text('pH')).
                        append($('<th>').text('Action'))
                    )
                ).
                // Add the body created above
                append(
                    screen_contents_table
                )
            )
        )
    )
    row.addClass('viewed-screen-highlight');
    $('#view-screen-button'+screen_id).text('Hide');
}

function get_last_row_of_wellcondition(row, select=true){
    // get the last row of the condition (last factor)
    let botrow = row;
    let rowspan = row.children().first().attr('rowspan');
    let count = 1;
    while (rowspan && count < rowspan){
        if (select){
            botrow.addClass('generated-recipe-highlight');
        } else {
            botrow.removeClass('generated-recipe-highlight');
        }
        botrow = botrow.next();
        count += 1;
    }
    if (select){
        botrow.addClass('generated-recipe-highlight');
    } else {
        botrow.removeClass('generated-recipe-highlight');
    }
    return botrow;
}

// Generate wellcondition recipe button function
function generate_recipe(wellcondition_id, row){
    // If recipe already generated, remove it
    let botrow = get_last_row_of_wellcondition(row, false);
    if (botrow.next().attr('id') == 'wellcondition-recipe-'+wellcondition_id){
        botrow.next().remove();
        $('#generate-condition-recipe-button'+wellcondition_id).text('Recipe');
    // If not, get recipe and display it
    } else {
        $.getJSON(API_URL+'/screens/conditionRecipe?condition_id='+wellcondition_id, function(data){
            display_recipe(data, wellcondition_id, row)
        });
    }
}

function display_recipe(recipe_data, wellcondition_id, row){
    // Create body to append rows to
    let recipe_table = $('<tbody>')
    // Loop recipe
    if (recipe_data.success){
        $.each(recipe_data.stocks, function(i, s){
            let recipe_row = $('<tr>');
            // What to display for each stock
            recipe_row.
            append($('<td>').text(s.stock.name)).
            append($('<td>').text(s.volume.toFixed(2)))
            // Add stock to recipe table
            recipe_table.append(recipe_row);
        })
        if (recipe_data.water > 0){
            recipe_table.append($('<tr>').
                append($('<td>').text('Water')).
                append($('<td>').text(recipe_data.water.toFixed(2)))
            )
        }
    } else {
        recipe_table.append($('<tr>').
            append($('<td>').attr('colspan', 2).text(recipe_data.msg))
        )
    }
    let botrow = get_last_row_of_wellcondition(row, true);
    // Create row in original table below condition row and add new recipe
    botrow.after(
        $('<tr>').
        attr('id', 'wellcondition-recipe-'+wellcondition_id).
        attr('class', 'generated-recipe-highlight generated-recipe-row').
        append(
            $('<td>').attr('colspan', '6')
            .append(
                $('<p>').text('Recipe:')
            ).append(
                // Recipe table
                $('<table>').attr('class', 'generated-recipe-table').
                append(
                    $('<thead>').append(
                        $('<tr>').append($('<th>').text('Stock')).
                        append($('<th>').text('Volume (ml)'))
                    )
                ).
                // Add the body created above
                append(
                    recipe_table
                )
            )
        )
    )
    $('#generate-condition-recipe-button'+wellcondition_id).text('Hide');
}

// Button to toggle screen query container
$('#query-screens').click(function(){
    if ($('#query-container').css("display") != 'block'){
        $('#query-container').css("display", "block");
    } else {
        $('#query-container').css("display", "none");
    }
})

$('#screen-name-search').change(function(){
    query_update_inputs(false);
})

$('#screen-owner-search').change(function(){
    query_update_inputs(false);
})

$('#button-query').click(function(){
    query_screens();
})

// Sub function for screen name string matching
function search_screen_names(term, screen_names){
    let out = [];
    $.each(screen_names, function(i, s){
        if (s.name.toLowerCase().includes(term.toLowerCase())){
            out.push({
                'value': s.name,
                'label': s.name,
                'id': s.id
            });
        }
    });
    return out;
}

// Sub function for chemical name string matching
function search_chemical_names(term, chemical_names){
    let out = [];
    $.each(chemical_names, function(i, c){
        if (c.name.toLowerCase().includes(term.toLowerCase())){
            out.push({
                'value': c.name,
                'label': c.name,
                'id': c.id
            });
        } else {
            for (i in c.aliases){
                if (c.aliases[i].name.toLowerCase().includes(term.toLowerCase())){
                    out.push({
                        'value': c.name,
                        'label': c.name + " (alias: " + c.aliases[i].name + ")",
                        'id': c.id
                    });
                    break;
                }
            }
        }
    });
    return out;
}

/*
 
   #####  ####### #     # ######      #####  #     # ####### ######  #     # 
  #     # #     # ##    # #     #    #     # #     # #       #     #  #   #  
  #       #     # # #   # #     #    #     # #     # #       #     #   # #   
  #       #     # #  #  # #     #    #     # #     # #####   ######     #    
  #       #     # #   # # #     #    #   # # #     # #       #   #      #    
  #     # #     # #    ## #     #    #    #  #     # #       #    #     #    
   #####  ####### #     # ######      #### #  #####  ####### #     #    #    
                                                                             
 
*/

// Search by conditions, enable logical operators and initialise with one condition
$('#button-search-by-condition').click(function() {
    $(this).css("display", "none");
    $(this).after(
        $('<button>').attr('id', 'button-cancel-search-by-condition')
        .css("display", "inline-block")
        .text('Cancel')
    ).
    after(
        $('<button>').attr('id', 'button-condition-remove')
        .css("display", "inline-block")
        .text('Remove (selection)')
    ).
    after(
        $('<button>').attr('id', 'button-condition-not')
        .css("display", "inline-block")
        .text('NOT (selection)')
    ).
    after(
        $('<button>').attr('id', 'button-condition-or')
        .css("display", "inline-block")
        .text('OR')
    ).
    after(
        $('<button>').attr('id', 'button-condition-and')
        .css("display", "inline-block")
        .text('AND')
    )
    
    // Add click handlers to created buttons
    $('#button-condition-and').click(function() {
        binop_condition('and');
    });
    $('#button-condition-or').click(function() {
        binop_condition('or');
    });
    $('#button-condition-not').click(function() {
        not_condition();
    });
    $('#button-condition-remove').click(function() {
        remove_condition();
    });

    
    // Cancel search by conditions, hide operators and remove any query
    $('#button-cancel-search-by-condition').click(function() {
        $('#button-search-by-condition').css("display", "inline-block");
        $('#button-condition-and').remove();
        $('#button-condition-or').remove();
        $('#button-condition-not').remove();
        $('#button-condition-remove').remove();
        $(this).remove();

        // Destroy condition search tree
        query_empty();
        $('#query-body-middle').empty();
    })

    // Create condition search tree
    let cond_div = create_condition_div();
    let chem_div = get_first_chemical_div_from_condition_div(cond_div)
    cond_div.click();
    query_init(cond_div, chem_div);
    $('#query-body-middle').append(
        create_logic_div().append(cond_div)
    );
})


/*
 
 ########  #### ##     ##    ##    ##    ###    ##     ## 
 ##     ##  ##  ##     ##    ###   ##   ## ##   ##     ## 
 ##     ##  ##  ##     ##    ####  ##  ##   ##  ##     ## 
 ##     ##  ##  ##     ##    ## ## ## ##     ## ##     ## 
 ##     ##  ##   ##   ##     ##  #### #########  ##   ##  
 ##     ##  ##    ## ##      ##   ### ##     ##   ## ##   
 ########  ####    ###       ##    ## ##     ##    ###    
 
*/

// Get the condition element id from jquery object
function get_condition_div_id(cond_div){
    return parseInt(cond_div.attr('id').slice(13));
}

// Get the chemical element id from jquery object
function get_chemical_div_id(chem_div){
    return parseInt(chem_div.attr('id').slice(12));
}

// Get the parent condition element id from chemical jquery object
function get_condition_div_id_from_chemical_div(chem_div){
    let cond_div = chem_div.closest('.condition-div');
    return get_condition_div_id(cond_div);
}

// Get the parent condition jquery object from a chemical jquery object
function get_condition_div_from_chemical_div(chem_div){
    return chem_div.closest('.condition-div');
}

// Get the first child chemical jquery object from a condition jquery object
function get_first_chemical_div_from_condition_div(cond_div){
    return cond_div.find('.chemical-div').first();
}

/*
 
  #######  ##     ## ######## ########  ##    ##    ########  #### ##     ##  ######  
 ##     ## ##     ## ##       ##     ##  ##  ##     ##     ##  ##  ##     ## ##    ## 
 ##     ## ##     ## ##       ##     ##   ####      ##     ##  ##  ##     ## ##       
 ##     ## ##     ## ######   ########     ##       ##     ##  ##  ##     ##  ######  
 ##  ## ## ##     ## ##       ##   ##      ##       ##     ##  ##   ##   ##        ## 
 ##    ##  ##     ## ##       ##    ##     ##       ##     ##  ##    ## ##   ##    ## 
  ##### ##  #######  ######## ##     ##    ##       ########  ####    ###     ######  
 
*/
//============================================================================//
// Creation of condition and chemical html components
//============================================================================//
/*
 
  #       #######  #####  ###  #####  
  #       #     # #     #  #  #     # 
  #       #     # #        #  #       
  #       #     # #  ####  #  #       
  #       #     # #     #  #  #       
  #       #     # #     #  #  #     # 
  ####### #######  #####  ###  #####  
                                      
 
*/

// Create a logic div for conditions and chemicals
function create_logic_div() {
    let ldiv = $('<div>').attr('class', 'logic-div');
    return ldiv
}

/*
 
   #####  ####### #     # ######  
  #     # #     # ##    # #     # 
  #       #     # # #   # #     # 
  #       #     # #  #  # #     # 
  #       #     # #   # # #     # 
  #     # #     # #    ## #     # 
   #####  ####### #     # ######  
                                  
 
*/

// Create a div for specifiying a condition
function create_condition_div() {
    // Create radio check for ALL or SOME quantifier
    let condition_div = $('<div>').attr('class', 'condition-div').
    attr('id', 'condition-div'+CONDITION_ID_COUNTER).
    append(
        $('<div>').attr('class', 'section-title').text('CONDITION')
    ).
    // Create dropdown for reference or chemical condition specification
    append(
        $('<select>').attr('id', 'condition-ref'+CONDITION_ID_COUNTER).
        attr('name', 'condition-ref'+CONDITION_ID_COUNTER).
        append(
            $('<option>').attr('value', 'chem').
            attr('selected', 'selected').
            text('Identified by chemical')
        ).
        append(
            $('<option>').attr('value', 'ref').
            text('Identified by reference')
        // Create field for specifing condition on change
        ).change(function() {
            cond = $(this).parent();
            cond_id = get_condition_div_id(cond);
            cond.children().last().remove();
            if ($(this).val() == 'chem'){
                cond.append(create_condition_chem_field(cond_id));
                query_by_chemical_condition(cond, get_first_chemical_div_from_condition_div(cond));
            } else if ($(this).val() == 'ref'){
                cond.append(create_condition_ref_field(cond_id));
                query_by_reference_condition(cond);
            }
        })
    ).
    append($('</br>')).
    append(
        $('<input>').attr('type', 'radio').
        attr('name', 'condition-quant'+CONDITION_ID_COUNTER).
        attr('id', 'condition-quant-e'+CONDITION_ID_COUNTER).
        attr('value', 'e').
        attr('checked', 'checked').
        change(function() {
            query_update_inputs(false);
        })
    ).
    append(
        $('<label>').attr('for', 'condition-quant-e'+CONDITION_ID_COUNTER).
        text('Some')
    ).
    append(
        $('<input>').attr('type', 'radio').
        attr('name', 'condition-quant'+CONDITION_ID_COUNTER).
        attr('id', 'condition-quant-a'+CONDITION_ID_COUNTER).
        attr('value', 'a').
        change(function() {
            query_update_inputs(false);
        })
    ).
    append(
        $('<label>').attr('for', 'condition-quant-a'+CONDITION_ID_COUNTER).
        text('All')
    ).
    append(' conditions in the screen').
    append($('</br>')).
    // Make condition selectable
    click(function () {
        $('.condition-div').removeClass('selected-condition');
        $(this).addClass('selected-condition');
    });
    // Init condition as being specified by chemical
    let condition_field = create_condition_chem_field(CONDITION_ID_COUNTER);
    condition_div.append(condition_field);

    CONDITION_ID_COUNTER += 1;
    return condition_div;
}

/*
 
   #####  ####### #     # ######     ####### ### ####### #       ######  
  #     # #     # ##    # #     #    #        #  #       #       #     # 
  #       #     # # #   # #     #    #        #  #       #       #     # 
  #       #     # #  #  # #     #    #####    #  #####   #       #     # 
  #       #     # #   # # #     #    #        #  #       #       #     # 
  #     # #     # #    ## #     #    #        #  #       #       #     # 
   #####  ####### #     # ######     #       ### ####### ####### ######  
                                                                         
 
*/

// Create field where condition is specified with chemical information
function create_condition_chem_field(condition_id){
    // Create border and logical operators
    let condition_field = $('<fieldset>').attr('id', 'condition-fieldset'+condition_id).
    attr('class', 'condition-chem-field').
    append(
        $('<legend>').text('meet the following')
    ).
    append(
        $('<div>').append(
            $('<button>').attr('id', 'button-chemical-and'+condition_id).
            text('AND').
            click(function(){
                binop_chemical('and', condition_id);
            })
        ).
        append(
            $('<button>').attr('id', 'button-chemical-or'+condition_id).
            text('OR').
            click(function(){
                binop_chemical('or', condition_id);
            })
        ).
        append(
            $('<button>').attr('id', 'button-chemical-not'+condition_id)
            .text('NOT (selection)').
            click(function(){
                not_chemical(condition_id);
            })
        ).
        append(
            $('<button>').attr('id', 'button-chemical-remove'+condition_id)
            .text('Remove (selection)').
            click(function(){
                remove_chemical(condition_id);
            })
        )
    );
    // Initialise with a chemical
    let chem_div = create_chemical_div();
    // Select if no global chemical selected
    if ($('.selected-chemical').length == 0){
        chem_div.click();
    }
    condition_field.append(
        $('<div>').attr('id', 'chemical-query'+condition_id).
        append(
            create_logic_div().append(chem_div)
        )
    );
    return condition_field;
}

// Create field where condition is specified with reference information
function create_condition_ref_field(condition_id){
    // Create border and logical operators
    let condition_field = $('<fieldset>').attr('id', 'condition-fieldset'+condition_id).
    append(
        $('<legend>').text('equal the one in')
    ).
    append(
        $('<table>').attr('class', 'input-table').
        append(
            $('<tr>').
            append(
                $('<td>').append(
                    $('<label>').attr('for', 'screen-id'+condition_id).
                    text('Screen Name')
                )
            ).
            append(
                $('<td>').append(
                    $('<input>').attr('id', 'screen-id'+condition_id).
                    attr('class', 'input-wide').
                    attr('name', 'screen-id'+condition_id).
                    attr('placeholder', 'Search screens').
                    attr('autocomplete-id', '').
                    autocomplete({
                        source: function (request, response){
                            if (SCREEN_NAMES == null){
                                $.getJSON(API_URL+'/screens/names', function(screen_names){
                                    SCREEN_NAMES = screen_names;
                                    response(search_screen_names(request.term, SCREEN_NAMES));
                                })
                            } else {
                                response(search_screen_names(request.term, SCREEN_NAMES));
                            }
                        },
                        select: function(event, ui) {
                            let well_dropdown = $(this).closest('.input-table').find('.input-location');
                            well_dropdown.empty();
                            well_dropdown.attr('disabled', 'disabled');
                            let id = ui.item.id;
                            if (id){
                                $.getJSON(API_URL+'/screens/wellNames?screen_id='+id, function(wells){
                                    $.each(wells, function(i, w){
                                        well_dropdown.append(
                                            $('<option>').attr('value', w.wellcondition_id)
                                            .text(w.label)
                                        )
                                    })
                                    well_dropdown.removeAttr('disabled');
                                })
                            }
                        },
                        change: function(event, ui){
                            let well_dropdown = $(this).closest('.input-table').find('.input-location');
                            if (ui.item){
                                $(this).val(ui.item.value);
                                $(this).attr('autocomplete-id', String(ui.item.id));
                                query_update_inputs(false);
                            } else {
                                $(this).val('');
                                $(this).attr('autocomplete-id', '');
                                well_dropdown.empty();
                                well_dropdown.append(
                                    $('<option>').attr('value', '').
                                    attr('selected', 'selected').
                                    text('No screen selected')
                                )
                                well_dropdown.attr('disabled', 'disabled');
                                query_update_inputs(false);
                            }
                        },
                        minLength: 1
                    })
                )
            )
        ).
        append(
            $('<tr>').
            append(
                $('<td>').append(
                    $('<label>').attr('for', 'wellcondition-id'+condition_id).
                    text('Location')
                )
            ).
            append(
                $('<td>').append(
                    $('<select>').attr('id', 'wellcondition-id'+condition_id).
                    attr('class', 'input-wide input-location').
                    attr('name', 'wellcondition-id'+condition_id).
                    attr('disabled', 'disabled').
                    append(
                        $('<option>').attr('value', '').
                        attr('selected', 'selected').
                        text('No screen selected')
                    ).
                    change(function () {
                        query_update_inputs(false);
                    })
                )
            )
        )
    );
    return condition_field;
}

/*
 
   #####  #     # ####### #     # 
  #     # #     # #       ##   ## 
  #       #     # #       # # # # 
  #       ####### #####   #  #  # 
  #       #     # #       #     # 
  #     # #     # #       #     # 
   #####  #     # ####### #     # 
                                  
 
*/

// Create div for specifiying a chemical
function create_chemical_div(){
    // Chemical id from drop down
    let chemical_div = $('<div>').attr('class', 'chemical-div').
    attr('id', 'chemical-div'+CHEMICAL_ID_COUNTER).
    append(
        $('<div>').attr('class', 'section-title').text('CHEMICAL')
    ).
    append(
        $('<input>').attr('type', 'radio').
        attr('name', 'chemical-quant'+CHEMICAL_ID_COUNTER).
        attr('id', 'chemical-quant-e'+CHEMICAL_ID_COUNTER).
        attr('value', 'e').
        attr('checked', 'checked').
        change(function(){
            query_update_inputs(false);
        })
    ).
    append(
        $('<label>').attr('for', 'chemical-quant-e'+CHEMICAL_ID_COUNTER).
        text('Some')
    ).
    append(
        $('<input>').attr('type', 'radio').
        attr('name', 'chemical-quant'+CHEMICAL_ID_COUNTER).
        attr('id', 'chemical-quant-a'+CHEMICAL_ID_COUNTER).
        attr('value', 'a').
        change(function(){
            query_update_inputs(false);
        })
    ).
    append(
        $('<label>').attr('for', 'chemical-quant-a'+CHEMICAL_ID_COUNTER).
        text('All')
    ).
    append(' chemicals in the condition are').
    append(
        $('<table>').attr('class', 'input-table').
        // Name search
        append(
            $('<tr>').append(
                $('<td>').append(
                    $('<label>').attr('for', 'chemical-id'+CHEMICAL_ID_COUNTER).
                    text('Chemical')
                )
            ).
            append(
                $('<td>').append(
                    $('<input>').attr('id', 'chemical-id'+CHEMICAL_ID_COUNTER).
                    attr('class', 'input-wide').
                    attr('name', 'chemical-id'+CHEMICAL_ID_COUNTER).
                    attr('placeholder', 'Search chemicals').
                    attr('autocomplete-id', '').
                    autocomplete({
                        source: function (request, response){
                            if (CHEMICAL_NAMES == null){
                                $.getJSON(API_URL+'/chemicals/names', function(chemical_names){
                                    CHEMICAL_NAMES = chemical_names;
                                    response(search_chemical_names(request.term, CHEMICAL_NAMES));
                                })
                            } else {
                                response(search_chemical_names(request.term, CHEMICAL_NAMES));
                            }
                        },
                        select: function(event, ui) {
                            let unit_dropdown = $(this).closest('.input-table').find('.input-units');
                            let id = ui.item.id;
                            if (id){
                                $.getJSON(API_URL+'/chemicals/chemical?chemical_id='+id, function(chemical){
                                    for (i in ALL_UNITS){
                                        if (ALL_UNITS[i] == chemical.unit){
                                            unit_dropdown.val(ALL_UNITS[i]);
                                            unit_dropdown.change();
                                        }
                                    }
                                })
                            }
                        },
                        change: function(event,ui){
                            let unit_dropdown = $(this).closest('.input-table').find('.input-units');
                            if (ui.item){
                                $(this).val(ui.item.value);
                                $(this).attr('autocomplete-id', String(ui.item.id));
                                query_update_inputs(false);
                            } else {
                                $(this).val('');
                                $(this).attr('autocomplete-id', '');
                                unit_dropdown.val(ALL_UNITS[0]);
                                unit_dropdown.change();
                                query_update_inputs(false);
                            }
                        },
                        minLength: 1
                    })
                )
            )
        ).
        // Concentration search
        append(
            $('<tr>').append(
                $('<td>').append(
                    $('<label>').attr('for', 'chemical-conc'+CHEMICAL_ID_COUNTER).
                    text('Concentration')
                )
            ).
            append(
                $('<td>').append(
                    $('<input>').attr('id', 'chemical-conc'+CHEMICAL_ID_COUNTER).
                    attr('class', 'input-conc').
                    attr('name', 'chemical-conc'+CHEMICAL_ID_COUNTER).
                    attr('type', 'number').
                    attr('min', '0').
                    attr('placeholder', 'Range: [0, inf)').
                    change(function(){
                        if ($(this).val() < 0){
                            $(this).val('');
                        }
                        query_update_inputs(false);
                    })
                ).append(
                    $('<select>').attr('id', 'chemical-units'+CHEMICAL_ID_COUNTER).
                    attr('class', 'input-units').
                    attr('name', 'chemical-units'+CHEMICAL_ID_COUNTER).
                    append(
                        ALL_UNITS.map(function(u){
                            let o = $('<option>').attr('value', u).
                                    text(u);
                            return o;
                        })
                    ).
                    change(function(){
                        query_update_inputs(false);
                    })
                )
            )
        ).
        // pH Search
        append(
            $('<tr>').append(
                $('<td>').append(
                    $('<label>').attr('for', 'chemical-ph'+CHEMICAL_ID_COUNTER).
                    text('pH')
                )
            ).
            append(
                $('<td>').append(
                    $('<input>').attr('id', 'chemical-ph'+CHEMICAL_ID_COUNTER).
                    attr('class', 'input-wide').
                    attr('name', 'chemical-ph'+CHEMICAL_ID_COUNTER).
                    attr('type', 'number').
                    attr('min', '0').
                    attr('max', '0').
                    attr('placeholder', 'Range: [0, 14]').
                    change(function(){
                        if ($(this).val() < 0 || $(this).val() > 14){
                            $(this).val('');
                        }
                        query_update_inputs(false);
                    })
                )
            )
        )
    ).
    click(function () {
        $('.chemical-div').removeClass('selected-chemical');
        $(this).addClass('selected-chemical');
    });

    chemical_div.click(function () {
        $('.chemical-div').removeClass('selected-chemical');
        $(this).addClass('selected-chemical');
    });

    CHEMICAL_ID_COUNTER += 1;
    return chemical_div;
}

/*
 
 ########  #### ##     ##    ##        #######   ######   ####  ######  
 ##     ##  ##  ##     ##    ##       ##     ## ##    ##   ##  ##    ## 
 ##     ##  ##  ##     ##    ##       ##     ## ##         ##  ##       
 ##     ##  ##  ##     ##    ##       ##     ## ##   ####  ##  ##       
 ##     ##  ##   ##   ##     ##       ##     ## ##    ##   ##  ##       
 ##     ##  ##    ## ##      ##       ##     ## ##    ##   ##  ##    ## 
 ########  ####    ###       ########  #######   ######   ####  ######  
 
*/
//============================================================================//
// Div Logic functions
//============================================================================//
/*
 
   #####  ####### #     # ######  
  #     # #     # ##    # #     # 
  #       #     # # #   # #     # 
  #       #     # #  #  # #     # 
  #       #     # #   # # #     # 
  #     # #     # #    ## #     # 
   #####  ####### #     # ######  
                                  
 
*/

// Function to get jquery object of currently selected condition
function get_selected_condition(){
    let cond_div = $('.selected-condition');
    if (cond_div.length == 0){
        console.log('No condition selected.');
        return null;
    } else if (cond_div.length > 1){
        throw new Error('Error! Multiple conditions marked as selected.');
    }
    return cond_div;
}

// Handling of AND and OR operators
function binop_condition(binop){
    let cond_div = get_selected_condition();
    if (cond_div == null){
        return;
    }
    // Get the parent logic div and the top level logic div
    let cond_logic = cond_div.parent();
    let logic_parent = cond_logic.parent();
    // Flag if left or right condition is selected to make new layout consistent
    if (logic_parent.children().last().is(cond_logic)){
        insert_right = true;
    } else {
        insert_right = false;
    }
    // Create new logiv div with selected and new conditions
    let op_logic = create_logic_div();
    let new_cond_logic = create_logic_div();
    let new_cond_div = create_condition_div();
    let new_chem_div = get_first_chemical_div_from_condition_div(new_cond_div);
    let binop_str = null;
    let binop_cls = null;
    if (binop == 'and'){
        binop_str = 'AND';
        binop_cls = 'and-title';
    } else {
        binop_str = 'OR';
        binop_cls = 'or-title';
    }
    op_logic.append(
        $('<div>').attr('class', 'section-title ' + binop_cls).
        text(binop_str)
    ).
    // Appending selected condition logic will move it from current position
    append(
        cond_logic
    ).
    append(
        new_cond_logic.append(new_cond_div)
    );
    // Insert according to which side was selected ot being with
    if (insert_right){
        logic_parent.append(op_logic);
    } else {
        op_logic.insertBefore(logic_parent.children().last());
    }
    // Update query tree object
    query_binop_condition(cond_div, new_cond_div, new_chem_div, binop);
}

// Handling of NOT operator
function not_condition(){
    let cond_div = get_selected_condition();
    if (cond_div == null){
        return;
    }
    // Get logic container and check if it has 1 or 2 children
    let cond_logic = cond_div.parent();
    // One child means to add negation
    if (cond_logic.children().length == 1){
        cond_logic.prepend(
            $('<div>').attr('class', 'section-title not-title').
            text('NOT')
        );
        // Update query tree object
        query_set_not_condition(cond_div, true);
    // Two means to remove negation
    } else if (cond_logic.children().length == 2){
        cond_logic.children().first().remove();
        // Update query tree object
        query_set_not_condition(cond_div, false);
    // More is an error
    } else {
        throw new Error('Error! Multiple conditions in lowest level logic div.')
    }
}

// Handling of remove operator
function remove_condition(){
    let cond_div = get_selected_condition();
    if (cond_div == null){
        return;
    }
    // Get operator logic div
    let cond_logic = cond_div.parent();
    let op_logic = cond_logic.parent();
    // Don't allow removal of last condition
    if (op_logic.is($('#query-body-middle'))){
        console.log('Cannot remove last condition.')
        return;
    }
    // Get sibling condition logic div (must be one sibling)
    if (op_logic.children().last().is(cond_logic)){
        keep_cond_logic = cond_logic.prev();
    } else {
        keep_cond_logic = op_logic.children().last();
    }
    // Replace whole operator logic div with one the siubling one
    op_logic.replaceWith(keep_cond_logic);
    // Update query tree object
    query_remove_condition(cond_div);
}

/*
 
   #####  #     # ####### #     # 
  #     # #     # #       ##   ## 
  #       #     # #       # # # # 
  #       ####### #####   #  #  # 
  #       #     # #       #     # 
  #     # #     # #       #     # 
   #####  #     # ####### #     # 
                                  
 
*/

// Function to get jquery object of currently selected condition
function get_selected_chemical(){
    let chem_div = $('.selected-chemical');
    if (chem_div.length == 0){
        console.log('No chemical selected.');
        return null;
    } else if (chem_div.length > 1){
        throw new Error('Error! Multiple chemicals marked as selected.');
    }
    return chem_div;
}

// Handling of AND and OR operators
function binop_chemical(binop, button_cond_id){
    let chem_div = get_selected_chemical();
    if (chem_div == null){
        return;
    }
    let cond_div = get_condition_div_from_chemical_div(chem_div);
    let cond_id = get_condition_div_id_from_chemical_div(chem_div);
    if (cond_id != button_cond_id){
        console.log('No chemical selected for this condition (binop action).');
        return;
    }

    // Get the parent logic div and the top level logic div
    let chem_logic = chem_div.parent();
    let logic_parent = chem_logic.parent();
    // Flag if left or right chemical is selected to make new layout consistent
    if (logic_parent.children().last().is(chem_logic)){
        insert_right = true;
    } else {
        insert_right = false;
    }
    // Create new logiv div with selected and new chemicals
    let op_logic = create_logic_div();
    let new_chem_logic = create_logic_div();
    let new_chem_div = create_chemical_div();
    let binop_str = null;
    let binop_cls = null;
    if (binop == 'and'){
        binop_str = 'AND';
        binop_cls = 'and-title';
    } else {
        binop_str = 'OR';
        binop_cls = 'or-title';
    }
    op_logic.append(
        $('<div>').attr('class', 'section-title ' + binop_cls).
        text(binop_str)
    ).
    // Appending selected chemical logic will move it from current position
    append(
        chem_logic
    ).
    append(
        new_chem_logic.append(new_chem_div)
    );
    // Insert according to which side was selected ot being with
    if (insert_right){
        logic_parent.append(op_logic);
    } else {
        op_logic.insertBefore(logic_parent.children().last());
    }
    // Update query tree object
    query_binop_chemical(cond_div, chem_div, new_chem_div, binop);
}

// Handling of NOT operator
function not_chemical(button_cond_id){
    let chem_div = get_selected_chemical();
    if (chem_div == null){
        return;
    }
    let cond_div = get_condition_div_from_chemical_div(chem_div);
    let cond_id = get_condition_div_id_from_chemical_div(chem_div);
    if (cond_id != button_cond_id){
        console.log('No chemical selected for this condition (not action).');
        return;
    }
    // Get logic container and check if it has 1 or 2 children
    let chem_logic = chem_div.parent();
    // One child means to add negation
    if (chem_logic.children().length == 1){
        chem_logic.prepend(
            $('<div>').attr('class', 'section-title not-title').
            text('NOT')
        );
        // Update query tree object
        query_set_not_chemical(cond_div, chem_div, true);
    // Two means to remove negation
    } else if (chem_logic.children().length == 2){
        chem_logic.children().first().remove();
        // Update query tree object
        query_set_not_chemical(cond_div, chem_div, false);
    // More is an error
    } else {
        throw new Error('Error! Multiple chemicals in lowest level logic div.')
    }
}

// Handling of remove operator
function remove_chemical(button_cond_id){
    let chem_div = get_selected_chemical();
    if (chem_div == null){
        return;
    }
    let cond_div = get_condition_div_from_chemical_div(chem_div);
    let cond_id = get_condition_div_id_from_chemical_div(chem_div);
    if (cond_id != button_cond_id){
        console.log('No chemical selected for this condition (remove action).');
        return;
    }
    // Get operator logic div
    let chem_logic = chem_div.parent();
    let op_logic = chem_logic.parent();
    // Don't allow removal of last chemical
    if (op_logic.is($('#chemical-query'+button_cond_id))){
        console.log('Cannot remove last chemical.')
        return;
    }
    // Get sibling chemical logic div (must be one sibling)
    if (op_logic.children().last().is(chem_logic)){
        keep_chem_logic = chem_logic.prev();
    } else {
        keep_chem_logic = op_logic.children().last();
    }
    // Replace whole operator logic div with the sibling one
    op_logic.replaceWith(keep_chem_logic);
    // Update query tree object
    query_remove_chemical(cond_div, chem_div);
}

/*
 
  #######  ##     ## ######## ########  ##    ##    ##        #######   ######   ####  ######  
 ##     ## ##     ## ##       ##     ##  ##  ##     ##       ##     ## ##    ##   ##  ##    ## 
 ##     ## ##     ## ##       ##     ##   ####      ##       ##     ## ##         ##  ##       
 ##     ## ##     ## ######   ########     ##       ##       ##     ## ##   ####  ##  ##       
 ##  ## ## ##     ## ##       ##   ##      ##       ##       ##     ## ##    ##   ##  ##       
 ##    ##  ##     ## ##       ##    ##     ##       ##       ##     ## ##    ##   ##  ##    ## 
  ##### ##  #######  ######## ##     ##    ##       ########  #######   ######   ####  ######  
 
*/
//============================================================================//
// Query tree functions
//============================================================================//
/*
 
  ### #     # ### ####### 
   #  ##    #  #     #    
   #  # #   #  #     #    
   #  #  #  #  #     #    
   #  #   # #  #     #    
   #  #    ##  #     #    
  ### #     # ###    #    
                          
 
*/
// Create query tree
function query_init(cond_div, chem_div){
    SCREEN_QUERY.conds = {
        'negate': false,
        'arg': {
            'universal_quantification': false,
            'id': null,
            'chems': {
                'negate': false,
                'arg': {
                    'universal_quantification': false,
                    'name_search': null,
                    'id': null,
                    'conc': null,
                    'units': null,
                    'ph': null,
                    // Additional details stored for easy parsing until query
                    'q_chemical_div': chem_div
                }
            },
            // Additional details stored for easy parsing until query
            'q_condition_div': cond_div
        }
    };
    console.log('Q: ', SCREEN_QUERY);
}

// Destroy query tree
function query_empty(){
    SCREEN_QUERY.conds = null;
    console.log('Q: ', SCREEN_QUERY);
}

/*
 
   #####  ####### #     # ######  
  #     # #     # ##    # #     # 
  #       #     # # #   # #     # 
  #       #     # #  #  # #     # 
  #       #     # #   # # #     # 
  #     # #     # #    ## #     # 
   #####  ####### #     # ######  
                                  
 
*/

// Add condition to query tree
function query_binop_condition(cond_div, new_cond_div, new_chem_div, binop){
    let cond_clause = query_get_cond_clause(cond_div, SCREEN_QUERY.conds);
    if (cond_clause == null){
        throw new Error('Error! Could not find condition in query tree for operation.');
    }
    let right = {
        'negate': false,
        'arg': {
            'universal_quantification': false,
            'id': null,
            'chems': {
                'negate': false,
                'arg': {
                    'universal_quantification': false,
                    'name_search': null,
                    'id': null,
                    'conc': null,
                    'units': null,
                    'ph': null,
                    // Additional details stored for easy parsing until query
                    'q_chemical_div': new_chem_div
                }
            },
            // Additional details stored for easy parsing until query
            'q_condition_div': new_cond_div
        }
    };
    let left = {
        'negate': cond_clause.negate,
        'arg': cond_clause.arg
    };
    cond_clause.negate = false;
    cond_clause.arg = {
        'op': binop,
        'arg_left': left,
        'arg_right': right
    };
    console.log('Q: ', SCREEN_QUERY);
}

// Negate condition in query tree
function query_set_not_condition(cond_div, not){
    let cond_clause = query_get_cond_clause(cond_div, SCREEN_QUERY.conds);
    if (cond_clause == null){
        throw new Error('Error! Could not find condition in query tree for negation.');
    }
    cond_clause.negate = not;
    console.log('Q: ', SCREEN_QUERY);
}

// Remove condition from query tree
function query_remove_condition(cond_div){
    let cond_parent_clause = query_get_cond_parent_clause(cond_div, SCREEN_QUERY.conds);
    if (cond_parent_clause == null){
        throw new Error('Error! Could not find condition in query tree for removal.');
    }
    // Either remove left argument
    if (!cond_parent_clause.arg.arg_left.arg.op && cond_parent_clause.arg.arg_left.arg.q_condition_div.is(cond_div)){
        cond_parent_clause.negate = cond_parent_clause.arg.arg_right.negate;
        cond_parent_clause.arg = cond_parent_clause.arg.arg_right.arg;
    // Or right argument
    } else if (!cond_parent_clause.arg.arg_right.arg.op && cond_parent_clause.arg.arg_right.arg.q_condition_div.is(cond_div)){
        cond_parent_clause.negate = cond_parent_clause.arg.arg_left.negate;
        cond_parent_clause.arg = cond_parent_clause.arg.arg_left.arg;
    
    }
    console.log('Q: ', SCREEN_QUERY);
}

// Specify condition by reference
function query_by_reference_condition(cond_div){
    let cond_clause = query_get_cond_clause(cond_div, SCREEN_QUERY.conds);
    if (cond_clause == null){
        throw new Error('Error! Could not find condition in query tree for adding reference.');
    }
    cond_clause.arg.chems = null;
    console.log('Q: ', SCREEN_QUERY);
}

// Specify condition by chemicals
function query_by_chemical_condition(cond_div, chem_div){
    let cond_clause = query_get_cond_clause(cond_div, SCREEN_QUERY.conds);
    if (cond_clause == null){
        throw new Error('Error! Could not find condition in query tree for adding chemical.');
    }
    cond_clause.arg.chems = {
        'negate': false,
        'arg': {
            'universal_quantification': false,
            'name_search': null,
            'id': null,
            'conc': null,
            'units': null,
            'ph': null,
            // Additional details stored for easy parsing until query
            'q_chemical_div': chem_div
        }
    };
    console.log('Q: ', SCREEN_QUERY);
}

// Get the clause of the condition in the query tree
function query_get_cond_clause(cond_div, tree){
    if (!tree.arg.op){
        if (tree.arg.q_condition_div.is(cond_div)){
            return tree;
        } else {
            return null;
        }
    } else {
        let left = query_get_cond_clause(cond_div, tree.arg.arg_left);
        if (left != null){
            return left;
        } else {
            return query_get_cond_clause(cond_div, tree.arg.arg_right);
        }
    }
}

// Get the clause with the binary operator above the specified condition
function query_get_cond_parent_clause(cond_div, tree){
    if (tree.arg.op){
        if (!tree.arg.arg_left.arg.op && tree.arg.arg_left.arg.q_condition_div.is(cond_div)){
            return tree;
        } else if (!tree.arg.arg_right.arg.op && tree.arg.arg_right.arg.q_condition_div.is(cond_div)){
            return tree;
        } else {
            let left = query_get_cond_parent_clause(cond_div, tree.arg.arg_left);
            if (left != null){
                return left;
            } else {
                return query_get_cond_parent_clause(cond_div, tree.arg.arg_right);
            }
        }
    } else {
        return null;
    }
}

/*
 
   #####  #     # ####### #     # 
  #     # #     # #       ##   ## 
  #       #     # #       # # # # 
  #       ####### #####   #  #  # 
  #       #     # #       #     # 
  #     # #     # #       #     # 
   #####  #     # ####### #     # 
                                  
 
*/

// Add chemical to query tree within condition
function query_binop_chemical(cond_div, chem_div, new_chem_div, binop){
    let cond_clause = query_get_cond_clause(cond_div, SCREEN_QUERY.conds);
    if (cond_clause == null){
        throw new Error('Error! Could not find condition in query tree for chemical operation.');
    }
    let chem_clause = query_get_chem_clause(chem_div, cond_clause.arg.chems);
    if (chem_clause == null){
        throw new Error('Error! Could not find chemical in query tree for operation.');
    }
    let right = {
        'negate': false,
        'arg': {
            'universal_quantification': false,
            'name_search': null,
            'id': null,
            'conc': null,
            'units': null,
            'ph': null,
            // Additional details stored for easy parsing until query
            'q_chemical_div': new_chem_div
        }
    };
    let left = {
        'negate': chem_clause.negate,
        'arg': chem_clause.arg
    }
    chem_clause.negate = false;
    chem_clause.arg = {
        'op': binop,
        'arg_left': left,
        'arg_right': right
    };
    console.log('Q: ', SCREEN_QUERY);
}

// Negate chemical in query tree within condition
function query_set_not_chemical(cond_div, chem_div, not){
    let cond_clause = query_get_cond_clause(cond_div, SCREEN_QUERY.conds);
    if (cond_clause == null){
        throw new Error('Error! Could not find condition in query tree for chemical operation.');
    }
    let chem_clause = query_get_chem_clause(chem_div, cond_clause.arg.chems);
    if (chem_clause == null){
        throw new Error('Error! Could not find chemical in query tree for operation.');
    }
    chem_clause.negate = not;
    console.log('Q: ', SCREEN_QUERY);
}

// Remove chemical from query tree within condition
function query_remove_chemical(cond_div, chem_div){
    let cond_clause = query_get_cond_clause(cond_div, SCREEN_QUERY.conds);
    if (cond_clause == null){
        throw new Error('Error! Could not find condition in query tree for chemical operation.');
    }
    let chem_parent_clause = query_get_chem_parent_clause(chem_div, cond_clause.arg.chems);
    if (chem_parent_clause == null){
        throw new Error('Error! Could not find chemical in query tree for removal.');
    }
    // Either remove left argument
    if (!chem_parent_clause.arg.arg_left.arg.op && chem_parent_clause.arg.arg_left.arg.q_chemical_div.is(chem_div)){
        chem_parent_clause.negate = chem_parent_clause.arg.arg_right.negate;
        chem_parent_clause.arg = chem_parent_clause.arg.arg_right.arg;
    // Or right argument
    } else if (!chem_parent_clause.arg.arg_right.arg.op && chem_parent_clause.arg.arg_right.arg.q_chemical_div.is(chem_div)){
        chem_parent_clause.negate = chem_parent_clause.arg.arg_left.negate;
        chem_parent_clause.arg = chem_parent_clause.arg.arg_left.arg;
    
    }
    console.log('Q: ', SCREEN_QUERY);
}

// Get the clause of the chemical in the query tree within a condition
function query_get_chem_clause(chem_div, tree){
    if (!tree.arg.op){
        if (tree.arg.q_chemical_div.is(chem_div)){
            return tree;
        } else {
            return null;
        }
    } else {
        let left = query_get_chem_clause(chem_div, tree.arg.arg_left);
        if (left != null){
            return left;
        } else {
            return query_get_chem_clause(chem_div, tree.arg.arg_right);
        }
    }
}

// Get the clause with the binary operator above the specified chemical within a condition
function query_get_chem_parent_clause(chem_div, tree){
    if (tree.arg.op){
        if (!tree.arg.arg_left.arg.op && tree.arg.arg_left.arg.q_chemical_div.is(chem_div)){
            return tree;
        } else if (!tree.arg.arg_right.arg.op && tree.arg.arg_right.arg.q_chemical_div.is(chem_div)){
            return tree;
        } else {
            let left = query_get_chem_parent_clause(chem_div, tree.arg.arg_left);
            if (left != null){
                return left;
            } else {
                return query_get_chem_parent_clause(chem_div, tree.arg.arg_right);
            }
        }
    } else {
        return null;
    }
}

/*
 
  ######  ######  #######  #####  #######  #####   #####  
  #     # #     # #     # #     # #       #     # #     # 
  #     # #     # #     # #       #       #       #       
  ######  ######  #     # #       #####    #####   #####  
  #       #   #   #     # #       #             #       # 
  #       #    #  #     # #     # #       #     # #     # 
  #       #     # #######  #####  #######  #####   #####  
                                                          
 
*/

// Update query from form elements
function query_update_inputs(alert_validation){
    // First parse screen name/owner inputs
    if ($('#screen-name-search').val() == ''){
        SCREEN_QUERY.name_search = null;
    } else {
        SCREEN_QUERY.name_search = $('#screen-name-search').val();
    }
    if ($('#screen-owner-search').val() == ''){
        SCREEN_QUERY.owner_search = null;
    } else {
        SCREEN_QUERY.owner_search = $('#screen-owner-search').val();
    }
    // Then recurse into conditions/chemicals
    if (SCREEN_QUERY.conds){
        query_update_conds(SCREEN_QUERY.conds, alert_validation);
    }
    console.log('Q: ', SCREEN_QUERY);

    // Final validation matching API parser
    if (alert_validation &&
        SCREEN_QUERY.name_search == null &&
        SCREEN_QUERY.owner_search == null &&
        SCREEN_QUERY.conds == null){

        alert("Must query screens by at least a name, owner name or by conditions!");
        return false;
    // When not validating always pass
    } else {
        return true;
    }
}
// Condition recursion for update
function query_update_conds(tree, alert_validation){
    // Parse recursively, ending if validation alert occurs
    if (tree.arg.op){
        let validated = query_update_conds(tree.arg.arg_left);
        if (validated){
            query_update_conds(tree.arg.arg_right);
        }
        return validated;
    // When in condition, read individual inputs
    } else {
        let cond_div = tree.arg.q_condition_div;
        let cond_id = get_condition_div_id(cond_div);
        if ($('input[name="condition-quant'+cond_id+'"]:checked').val() == 'a'){
            tree.arg.universal_quantification = true;
        } else {
            tree.arg.universal_quantification = false;
        }
        // Recurse into chemicals
        if (tree.arg.chems){
            tree.arg.id = null;
            query_update_chems(tree.arg.chems, alert_validation);
        } else {
            tree.arg.id = $('select[name="wellcondition-id'+cond_id+'"]').val();
        }

        // Final validation matching API parser
        if (alert_validation &&
            tree.arg.id == null &&
            tree.arg.chems == null){
                
            alert("Must specify condition exclusively either by reference or by chemicals!");
            return false;
        // When not validating always continue parsing
        } else {
            return true;
        }
    }
}
// CHemical recursion for update
function query_update_chems(tree, alert_validation){
    // Parse recursively, ending if validation alert occurs
    if (tree.arg.op){
        let validated = query_update_chems(tree.arg.arg_left);
        if (validated){
            query_update_chems(tree.arg.arg_right);
        }
        return validated;
    // When in chemical, read individual inputs
    } else {
        let chem_div = tree.arg.q_chemical_div;
        let chem_id = get_chemical_div_id(chem_div);
        if ($('input[name="chemical-quant'+chem_id+'"]:checked').val() == 'a'){
            tree.arg.universal_quantification = true;
        } else {
            tree.arg.universal_quantification = false;
        }
        tree.arg.name_search = null;
        if ($('input[name="chemical-id'+chem_id+'"]').val() == ''){
            tree.arg.id = null;
        } else {
            tree.arg.id = $('input[name="chemical-id'+chem_id+'"]').attr('autocomplete-id');
        }
        if ($('input[name="chemical-conc'+chem_id+'"]').val() == ''){
            tree.arg.conc = null;
            tree.arg.units = null;
        } else {
            tree.arg.conc = $('input[name="chemical-conc'+chem_id+'"]').val();
            tree.arg.units = $('select[name="chemical-units'+chem_id+'"]').val();
        }
        if ($('input[name="chemical-ph'+chem_id+'"]').val() == ''){
            tree.arg.ph = null;
        } else {
            tree.arg.ph = $('input[name="chemical-ph'+chem_id+'"]').val();
        }

        // Final validation matching API parser
        if (alert_validation){
            if (tree.arg.id == null &&
                tree.arg.name_search == null){

                alert("Must specify chemical!");
                return false;
            } else if (tree.arg.id == null &&
                tree.arg.name_search == null &&
                tree.arg.conc == null &&
                tree.arg.ph == null){

                alert("Must specify chemical with at least name, concentration and unit, or ph!");
                return false
            } else {
                return true;
            }
        // When not validating always continue parsing
        } else {
            return true;
        }
    }
}

// Make screen query
function query_screens(){
    // Update inputs with notifications for validation errors
    let validated = query_update_inputs(true);
    if (!validated){
        return;
    }
    // If no errors, clear currently displayed screens and query API
    let api_query = JSON.stringify(SCREEN_QUERY, query_drop_extra);
    screen_table_body = $('#screen-table > tbody');
    screen_table_body.empty();
    $.ajax({
        type: 'POST',
        url: API_URL+'/screens/query', 
        data: api_query, 
        // Display returned screens
        success: function(data) {
            let api_well_query = null;
            if (SCREEN_QUERY.conds){
                api_well_query = JSON.stringify($.extend(true, {}, SCREEN_QUERY.conds), query_drop_extra);
            }
            display_screens(data, api_well_query);
        }, 
        dataType: 'json',
        contentType: 'application/json'
    });
}

// Replacer function to drop query object keys not needed for API call
function query_drop_extra(key, value){
    if (key === 'q_condition_div'){
        return undefined;
    } else if (key === 'q_chemical_div'){
        return undefined;
    } else {
        return value;
    }
}



// Close document ready and namespace functions
});
})();