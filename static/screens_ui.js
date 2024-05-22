(function() {
// Connection parameters
API_IP = '13.236.58.27'
API_PORT = '8000'
API_URL = 'http://'+API_IP+':'+API_PORT+'/api'

// Load rest once document is ready
$(document).ready(function() {

$('#all_screens').click(function(){
    $.getJSON(API_URL+'/screens', function(data) {
        screen_table = $('#screen_table');
        $.each(data, function(i,s){
            screen_table.
                append($('<tr>').attr('id',i).
                    append($('<td>').text(s.name)).
                    append($('<td>').text(s.creator)).
                    append($('<td>').text(s.creation_date)).
                    append($('<td>').text(s.format_name)).
                    append($('<td>').text(s.format_rows)).
                    append($('<td>').text(s.format_cols)).
                    append($('<td>').text(s.comments)));
        });
    });
})

$('#query_screens').click(function(){
    $('#query_container').css("visibility", "visible");
})


let QUERY_TREE = {};
let CONDITION_ID_COUNTER = 0;
let CHEMICAL_ID_COUNTER = 0;

//============================================================================//
// Buttons to commence or cancel search by conditions
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
    $('.query-body-middle').append(
        create_logic_div().append(create_condition_div())
    );
})

// Cancel search by conditions, hide operators and remove any query
$('#button-cancel-search-by-condition').click(function() {
    $('#button-search-by-condition').css("display", "inline-block");
    $('#button-condition-and').css("display", "none");
    $('#button-condition-or').css("display", "none");
    $('#button-condition-not').css("display", "none");
    $('#button-condition-remove').css("display", "none");
    $(this).css("display", "none");

    // Destroy condition search tree
    $('.query-body-middle').empty();
})

// Create a logic div for conditions and chemicals
function create_logic_div() {
    let ldiv = $('<div>').attr('class', 'logic-div');
    return ldiv
}

//============================================================================//
// Creation of condition and chemical html components
//============================================================================//

// Create a div for specifiying a condition
function create_condition_div() {
    // Create radio check for ALL or SOME quantifier
    let condition_div = $('<div>').attr('class', 'condition-div').
    attr('id', 'condition-div'+CONDITION_ID_COUNTER).
    append('Match ').
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
    append(' Conditions').
    append($('</br>')).
    // Create dropdown for reference or chemical condition specification
    append(
        $('<select>').attr('id', 'condition-ref'+CONDITION_ID_COUNTER).
        attr('name', 'condition-ref'+CONDITION_ID_COUNTER).
        append(
            $('<option>').attr('value', 'chem').
            attr('selected', 'selected').
            text('By Chemical')
        ).
        append(
            $('<option>').attr('value', 'ref').
            text('By Reference')
        )
    );
    let condition_field = create_condition_chem_field(CONDITION_ID_COUNTER);
    condition_div.append(condition_field);

    CONDITION_ID_COUNTER += 1;
    return condition_div;
}

// Create field where condition is specified with chemical information
function create_condition_chem_field(condition_id){
    // Create border and logical operators
    let condition_field = $('<fieldset>').attr('id', 'condition-fieldset'+condition_id).
    append(
        $('<legend>').text('Condition contains')
    ).
    append(
        $('<div>').append(
            $('<button>').attr('id', null)
            .text('AND')
        ).
        append(
            $('<button>').attr('id', null)
            .text('OR')
        ).
        append(
            $('<button>').attr('id', null)
            .text('NOT')
        ).
        append(
            $('<button>').attr('id', null)
            .text('Remove')
        )
    );
    // Initialise with a chemical
    condition_field.append(
        create_logic_div().append(create_chemical_div())
    );
    return condition_field;
}

// Create field where condition is specified with reference information
function create_condition_ref_field(){

}

// Create div for specifiying a chemical
function create_chemical_div(){
    // Chemical id from drop down
    let chemical_div = $('<div>').attr('class', 'chemical-div details').
    attr('id', 'chemical-div'+CHEMICAL_ID_COUNTER).
    append(
        $('<label>').attr('for', 'chemical-id'+CHEMICAL_ID_COUNTER).
        text('Chemical')
    ).
    append(
        $('<select>').attr('id', 'chemical-id'+CHEMICAL_ID_COUNTER).
        attr('name', 'chemical-id'+CHEMICAL_ID_COUNTER).
        append(
            $('<option>').attr('value', 'temp').
            attr('selected', 'selected').
            text('TODO')
        )
    ).
    append($('</br>')).
    // Name search
    append(
        $('<label>').attr('for', 'chemical-name-search'+CHEMICAL_ID_COUNTER).
        text('Name Search')
    ).
    append(
        $('<input>').attr('id', 'chemical-name-search'+CHEMICAL_ID_COUNTER).
        attr('name', 'chemical-name-search'+CHEMICAL_ID_COUNTER)
    ).
    append($('</br>')).
    // Concentration search
    append(
        $('<label>').attr('for', 'chemical-conc'+CHEMICAL_ID_COUNTER).
        text('Conc.')
    ).
    append(
        $('<input>').attr('id', 'chemical-conc'+CHEMICAL_ID_COUNTER).
        attr('name', 'chemical-conc'+CHEMICAL_ID_COUNTER)
    ).
    append(
        $('<select>').attr('id', 'chemical-units'+CHEMICAL_ID_COUNTER).
        attr('name', 'chemical-units'+CHEMICAL_ID_COUNTER).
        append(
            $('<option>').attr('value', 'temp').
            attr('selected', 'selected').
            text('TODO')
        )
    ).
    append($('</br>')).
    // pH Search
    append(
        $('<label>').attr('for', 'chemical-ph'+CHEMICAL_ID_COUNTER).
        text('pH')
    ).
    append(
        $('<input>').attr('id', 'chemical-ph'+CHEMICAL_ID_COUNTER).
        attr('name', 'chemical-ph'+CHEMICAL_ID_COUNTER)
    );
    CHEMICAL_ID_COUNTER += 1;
    return chemical_div;
}


// Close document ready and namespace functions
});
})();