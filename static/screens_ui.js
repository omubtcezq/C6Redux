(function() {
// Connection parameters
API_IP = '13.236.58.27'
//API_IP = 'localhost'
API_PORT = '8000'
API_URL = 'http://'+API_IP+':'+API_PORT+'/api'

// Load rest once document is ready
$(document).ready(function() {

// Load all screens button
$('#all-screens').click(function(){
    $.getJSON(API_URL+'/screens', function(data) {
        screen_table_body = $('#screen-table > tbody');
        $.each(data, function(i,s){
            
            // Add all screen components to row
            screen_table_body.append(
                $('<tr>').attr('id','screen-'+s.id).
                append($('<td>').text(s.id)).
                append($('<td>').text(s.name)).
                append($('<td>').text(s.creator)).
                append($('<td>').text(s.creation_date)).
                append($('<td>').text(s.format_name)).
                append($('<td>').text(s.format_rows)).
                append($('<td>').text(s.format_cols)).
                append($('<td>').text(s.comments)).
                // Include button to view the screen calling function defined above
                append(
                    $('<td>').attr('class', 'button-cell').
                    append(
                        $('<button>').attr('id', 'view-screen-button'+s.id).
                        text('View').
                        click(function () {
                            // Load screen contents given id and the screen row
                            load_screen_contents(s.id, $(this).parent().parent());
                        })
                    )
                )
            );
        });
    });
})

// Load screen contents button function
function load_screen_contents(screen_id, row){
    // If screen already viewed, remove it
    if (row.next().attr('id') == 'screen-contents-'+screen_id){
        row.next().remove();
        $('#view-screen-button'+screen_id).text('View');
        row.removeClass('viewed-screen');
    // If not, get screen contents and display them
    } else {
        $.getJSON(API_URL+'/screens/contents?id='+screen_id, function(contents_data) {
            // Create body to append rows to
            let screen_contents_table = $('<tbody>')
            // Loop wells
            $.each(contents_data.wells, function(i, w){
                // First row should include cell for well label
                let first = true;
                contents_row = $('<tr>');
                factors = w.wellcondition.factor_links.length;
                contents_row.append(
                    $('<td>').attr('rowspan', factors).
                    text(w.label)
                );
                // Loop factors
                $.each(w.wellcondition.factor_links, function(i, fl){
                    // If not first row of well create a new one
                    if (!first){
                        contents_row = $('<tr>');
                    }
                    else {
                        first = false;
                    }
                    // What to display for each factor
                    contents_row.
                    append($('<td>').text(fl.factor.chemical.name)).
                    append($('<td>').text(fl.factor.concentration)).
                    append($('<td>').text(fl.factor.unit)).
                    append($('<td>').text(fl.factor.ph)).
                    append($('<td>').text(fl.classvar ? fl.classvar.name : null))
                    
                    // Add row to contents table
                    screen_contents_table.append(contents_row);
                })
                
            })
            // Create row in original table below screen row and add new contents table there
            row.after(
                $('<tr>').
                attr('id', 'screen-contents-'+screen_id).
                attr('class', 'viewed-screen').
                append(
                    $('<td>').attr('colspan', '9')
                    .append(
                        // Contents table
                        $('<table>').attr('class', 'screen-contents-table').
                        append(
                            $('<thead>').append(
                                $('<tr>').append($('<th>').text('Well')).
                                append($('<th>').text('Chemical')).
                                append($('<th>').text('Concentration')).
                                append($('<th>').text('Units')).
                                append($('<th>').text('pH')).
                                append($('<th>').text('Class'))
                            )
                        ).
                        // Add the body created above
                        append(
                            screen_contents_table
                        )
                    )
                )
            )
            row.addClass('viewed-screen');
            $('#view-screen-button'+screen_id).text('Hide');
        })
    }
}


$('#query-screens').click(function(){
    if ($('#query-container').css("display") != 'block'){
        $('#query-container').css("display", "block");
    } else {
        $('#query-container').css("display", "none");
    }
})


let QUERY_TREE = null;
let SELECTED_CONDITION = null;
let SELECTED_CHEMICAL = null;

let CONDITION_ID_COUNTER = 0;
let CHEMICAL_ID_COUNTER = 0;

let ALL_UNITS = [
    'M',
    'v/v',
    'w/v',
    'mM',
    'mg/ml'
]

//============================================================================//
// Query buttons
//============================================================================//

// Search by conditions, enable logical operators and initialise with one condition
$('#button-search-by-condition').click(function() {
    $(this).css("display", "none");
    $('#button-condition-and').css("display", "inline-block");
    $('#button-condition-or').css("display", "inline-block");
    $('#button-condition-not').css("display", "inline-block");
    $('#button-condition-remove').css("display", "inline-block");
    $('#button-cancel-search-by-condition').css("display", "inline-block");

    // Create condition search tree
    let cond_div = create_condition_div();
    cond_div.click();
    init_query_condition(cond_div);
    $('#query-body-middle').append(
        create_logic_div().append(cond_div)
    );
})

// Cancel search by conditions, hide operators and remove any query
$('#button-cancel-search-by-condition').click(function() {
    $('#button-search-by-condition').css("display", "inline-block");
    $('#button-condition-and').css("display", "none")
    $('#button-condition-or').css("display", "none")
    $('#button-condition-not').css("display", "none");
    $('#button-condition-remove').css("display", "none");
    $(this).css("display", "none");

    // Destroy condition search tree
    empty_query_condition();
    $('#query-body-middle').empty();
})

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

//============================================================================//
// Creation of condition and chemical html components
//============================================================================//

// Create a logic div for conditions and chemicals
function create_logic_div() {
    let ldiv = $('<div>').attr('class', 'logic-div');
    return ldiv
}

// Get the condition element id from jquery object
function get_condition_div_id(cond){
    return parseInt(cond.attr('id').slice(13));
}

function get_condition_id_of_chemical(chem){
    cond = chem.closest('.condition-div');
    return get_condition_div_id(cond);
}

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
            } else if ($(this).val() == 'ref'){
                cond.append(create_condition_ref_field(cond_id));
            }
        })
    ).
    append($('</br>')).
    append(
        $('<input>').attr('type', 'radio').
        attr('name', 'condition-quant'+CONDITION_ID_COUNTER).
        attr('id', 'condition-quant-e'+CONDITION_ID_COUNTER).
        attr('value', 'e').
        attr('checked', 'checked')
    ).
    append(
        $('<label>').attr('for', 'condition-quant-e'+CONDITION_ID_COUNTER).
        text('Some')
    ).
    append(
        $('<input>').attr('type', 'radio').
        attr('name', 'condition-quant'+CONDITION_ID_COUNTER).
        attr('id', 'condition-quant-a'+CONDITION_ID_COUNTER).
        attr('value', 'a')
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
        SELECTED_CONDITION = $(this);
    });
    // Init condition as being specified by chemical
    let condition_field = create_condition_chem_field(CONDITION_ID_COUNTER);
    condition_div.append(condition_field);

    CONDITION_ID_COUNTER += 1;
    return condition_div;
}

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
                    attr('placeholder', 'Search all screens')
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
                    attr('class', 'input-wide').
                    attr('name', 'wellcondition-id'+condition_id).
                    attr('disabled', 'disabled').
                    append(
                        $('<option>').attr('value', 'temp').
                        attr('selected', 'selected').
                        text('TODO')
                    )
                )
            )
        )
    );
    return condition_field;
}

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
        attr('checked', 'checked')
    ).
    append(
        $('<label>').attr('for', 'chemical-quant-e'+CHEMICAL_ID_COUNTER).
        text('Some')
    ).
    append(
        $('<input>').attr('type', 'radio').
        attr('name', 'chemical-quant'+CHEMICAL_ID_COUNTER).
        attr('id', 'chemical-quant-a'+CHEMICAL_ID_COUNTER).
        attr('value', 'a')
    ).
    append(
        $('<label>').attr('for', 'chemical-quant-a'+CONDITION_ID_COUNTER).
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
                    attr('placeholder', 'Search all chemicals')
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
                    attr('placeholder', 'Range: [0, inf)')
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
                        // $('<option>').attr('value', 'temp').
                        // attr('selected', 'selected').
                        // text('TODO')
                    )
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
                    attr('placeholder', 'Range: [0, 14]')
                )
            )
        )
    ).
    click(function () {
        $('.chemical-div').removeClass('selected-chemical');
        $(this).addClass('selected-chemical');
        SELECTED_CHEMICAL = $(this);
    });

    chemical_div.click(function () {
        $('.chemical-div').removeClass('selected-chemical');
        $(this).addClass('selected-chemical');
        SELECTED_CHEMICAL = $(this);
    });

    CHEMICAL_ID_COUNTER += 1;
    return chemical_div;
}

//============================================================================//
// Query tree functions
//============================================================================//

// Create query tree
function init_query_condition(cond){
    QUERY_TREE = {
        'op': 'none', 
        'condition' : cond
    };
    console.log('QT: ', QUERY_TREE);
}

// Destroy query tree
function empty_query_condition(){
    QUERY_TREE = null;
    console.log('QT: ', QUERY_TREE);
}

// Add condition to query tree
function binop_query_condition(cond, new_cond, binop){
    tree_obj = get_query_obj_cond(cond, QUERY_TREE);
    if (tree_obj == null){
        throw new Error('Error! Could not find condition in query tree for operation.');
    }
    tree_obj.left = {
        'op': tree_obj.op,
        'condition': tree_obj.condition
    };
    tree_obj.op = binop;
    tree_obj.right = {
        'op': 'none',
        'condition': new_cond
    };
    delete tree_obj.condition;
    console.log('QT: ', QUERY_TREE);
}

// Negate condition in query tree
function set_not_query_condition(cond, not){
    tree_obj = get_query_obj_cond(cond, QUERY_TREE);
    if (tree_obj == null){
        throw new Error('Error! Could not find condition in query tree for negation.');
    }
    if (not) {
        tree_obj.op = 'not';
    } else {
        tree_obj.op = 'none';
    }
    console.log('QT: ', QUERY_TREE);
}

// Remove condition from query tree
function remove_query_condition(cond){
    tree_cond_obj = get_query_obj_cond(cond, QUERY_TREE);
    tree_parent_obj = get_query_obj_cond_parent(cond, QUERY_TREE);
    if ((tree_parent_obj.left.op == 'none' || tree_parent_obj.left.op == 'not') &&
        tree_parent_obj.left.condition.is(cond)){
        
        tree_parent_obj.op = tree_parent_obj.right.op;
        if (tree_parent_obj.right.condition){
            tree_parent_obj.condition = tree_parent_obj.right.condition;
            delete tree_parent_obj.left;
            delete tree_parent_obj.right;
        } else {
            tree_parent_obj.left = tree_parent_obj.right.left;
            tree_parent_obj.right = tree_parent_obj.right.right;
        }
    } else if ((tree_parent_obj.right.op == 'none' || tree_parent_obj.right.op == 'not') &&
               tree_parent_obj.right.condition.is(cond)){
        
        tree_parent_obj.op = tree_parent_obj.left.op;
        if (tree_parent_obj.left.condition){
            tree_parent_obj.condition = tree_parent_obj.left.condition;
            delete tree_parent_obj.left;
            delete tree_parent_obj.right;
        } else {
            tree_parent_obj.left = tree_parent_obj.left.left;
            tree_parent_obj.right = tree_parent_obj.left.right;
        }
    } else {
        throw new Error('Error! Could not find condition in query tree for removal.')
    }
    console.log('QT: ', QUERY_TREE);
}

// Get the node of the query tree with the specified condition
function get_query_obj_cond(cond, tree){
    if (tree.op == 'none' || tree.op == 'not'){
        if (tree.condition.is(cond)){
            return tree;
        } else {
            return null;
        }
    } else {
        let left = get_query_obj_cond(cond, tree.left);
        if (left != null) {
            return left;
        } else {
            return get_query_obj_cond(cond, tree.right);
        }
    }
}

// Get the binary operator node of query tree above the specified condition
function get_query_obj_cond_parent(cond, tree){
    if (tree.op == 'and' || tree.op == 'or'){
        if (tree.left.op == 'none' || tree.left.op == 'not'){
            if (tree.left.condition.is(cond)){
                return tree;
            }
        }
        if (tree.right.op == 'none' || tree.right.op == 'not'){
            if (tree.right.condition.is(cond)){
                return tree;
            }
        }
        let left = get_query_obj_cond_parent(cond, tree.left);
        if (left != null) {
            return left;
        } else {
            return get_query_obj_cond_parent(cond, tree.right);
        }
    } else {
        return null;
    }
}

//============================================================================//
// Condition Logic functions
//============================================================================//

// Function to get jquery object of currently selected condition
function get_selected_condition(){
    let cond = $('.selected-condition');
    if (cond.length == 0){
        console.log('No condition selected.');
        return null;
    } else if (cond.length > 1){
        throw new Error('Error! Multiple conditions marked as selected.');
    }
    return cond;
}

// Handling of AND and OR operators
function binop_condition(binop){
    let cond = get_selected_condition();
    if (cond == null){
        return;
    }
    // Get the parent logic div and the top level logic div
    let cond_logic = cond.parent();
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
    let new_cond = create_condition_div();
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
        new_cond_logic.append(new_cond)
    );
    // Insert according to which side was selected ot being with
    if (insert_right){
        logic_parent.append(op_logic);
    } else {
        op_logic.insertBefore(logic_parent.children().last());
    }
    // Update query tree object
    binop_query_condition(cond, new_cond, binop);
}

// Handling of NOT operator
function not_condition(){
    let cond = get_selected_condition();
    if (cond == null){
        return;
    }
    // Get logic container and check if it has 1 or 2 children
    let cond_logic = cond.parent();
    // One child means to add negation
    if (cond_logic.children().length == 1){
        cond_logic.prepend(
            $('<div>').attr('class', 'section-title not-title').
            text('NOT')
        );
        // Update query tree object
        set_not_query_condition(cond, true);
    // Two means to remove negation
    } else if (cond_logic.children().length == 2){
        cond_logic.children().first().remove();
        // Update query tree object
        set_not_query_condition(cond, false);
    // More is an error
    } else {
        throw new Error('Error! Multiple conditions in lowest level logic div.')
    }
}

// Handling of remove operator
function remove_condition(){
    let cond = get_selected_condition();
    if (cond == null){
        return;
    }
    // Get operator logic div
    let cond_logic = cond.parent();
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
    remove_query_condition(cond);
}

//============================================================================//
// Chemical logic functions
//============================================================================//

// Function to get jquery object of currently selected condition
function get_selected_chemical(){
    let chem = $('.selected-chemical');
    if (chem.length == 0){
        console.log('No chemical selected.');
        return null;
    } else if (chem.length > 1){
        throw new Error('Error! Multiple chemicals marked as selected.');
    }
    return chem;
}

// Handling of AND and OR operators
function binop_chemical(binop, button_cond_id){
    let chem = get_selected_chemical();
    if (chem == null){
        return;
    }
    cond_id = get_condition_id_of_chemical(chem);
    if (cond_id != button_cond_id){
        console.log('No chemical selected for this condition (binop action).');
        return;
    }

    // Get the parent logic div and the top level logic div
    let chem_logic = chem.parent();
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
    let new_chem = create_chemical_div();
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
        new_chem_logic.append(new_chem)
    );
    // Insert according to which side was selected ot being with
    if (insert_right){
        logic_parent.append(op_logic);
    } else {
        op_logic.insertBefore(logic_parent.children().last());
    }
    // Update query tree object
    //binop_query_chemical(chem, new_chem, binop);
}

// Handling of NOT operator
function not_chemical(button_cond_id){
    let chem = get_selected_chemical();
    if (chem == null){
        return;
    }
    cond_id = get_condition_id_of_chemical(chem);
    if (cond_id != button_cond_id){
        console.log('No chemical selected for this condition (binop action).');
        return;
    }
    // Get logic container and check if it has 1 or 2 children
    let chem_logic = chem.parent();
    // One child means to add negation
    if (chem_logic.children().length == 1){
        chem_logic.prepend(
            $('<div>').attr('class', 'section-title not-title').
            text('NOT')
        );
        // Update query tree object
        //set_not_query_chemical(chem, true);
    // Two means to remove negation
    } else if (chem_logic.children().length == 2){
        chem_logic.children().first().remove();
        // Update query tree object
        //set_not_query_chemical(chem, false);
    // More is an error
    } else {
        throw new Error('Error! Multiple chemicals in lowest level logic div.')
    }
}

// Handling of remove operator
function remove_chemical(button_cond_id){
    let chem = get_selected_chemical();
    if (chem == null){
        return;
    }
    cond_id = get_condition_id_of_chemical(chem);
    if (cond_id != button_cond_id){
        console.log('No chemical selected for this condition (binop action).');
        return;
    }
    // Get operator logic div
    let chem_logic = chem.parent();
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
    // Replace whole operator logic div with one the siubling one
    op_logic.replaceWith(keep_chem_logic);
    // Update query tree object
    //remove_query_chemical(chem);
}



// Close document ready and namespace functions
});
})();