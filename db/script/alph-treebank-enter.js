/**
 * @fileoverview alph-treebank-enter - treebank entry
 *  
 * 
 * Copyright 2013 The Alpheios Project, Ltd.
 *           2009 Cantus Foundation
 * http://alpheios.net
 * 
 * This file is part of Alpheios.
 * 
 * Alpheios is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * Alpheios is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
$(document).ready(function() {

    $("input[name='lang']").change(toggle_tokenization_options);
});

function EnterSentence(a_event)
{

    var treebank;
    // get input form and URL to use to add sentence
    var form = $("form[name='input-form']", document);
    var url = $("meta[name='url']", document).attr("content");
    var dir = $("#dir-buttons input:checked",form).val();
    $("input[name='inputtext']",form).attr("dir",dir);
    // create text of sentence
    var fmt = $("#format-buttons input:checked", form).val();
    var lang = $("#lang-buttons input:checked", form).val();
    var tokenization_service = $("meta[name='tokenization_service_" + lang + "']");
    if (tokenization_service.length == 0) {
        tokenization_service = $("meta[name='tokenization_service']");
    }
    if (tokenization_service.length == 1) {
        var base_svc = tokenization_service.attr("content");
        base_svc = base_svc + "?";
        var form_atts = tokenization_service.attr("data-params").split(' ');
        var transform = tokenization_service.attr("data-transform");
        for (var i=0; i<form_atts.length; i++) {
            var pair = form_atts[i];
            var input_elem = pair;
            var service_param = pair;
            // a | in the parmater name means the actual form param is before the piple
            // and the name of the param to pass to the tokenization service is after the pipe
            // if no | then the form and service params are the same
            if (pair.match(/\|/)) {
                var parts = pair.split(/\|/);
                input_elem = parts[0];
                service_param = parts[1];
            }
            // TODO this should be a POST
            // transform checkboxes to true/false
            var val = $("*[name='" + input_elem + "']").val();
            if ($("*[name='" + input_elem + "']").attr("type") == 'checkbox') {
                val = val == 'on' ? 'true' : 'false';
            }
            if (val) {
                base_svc = base_svc + "&" + service_param + "=" + encodeURIComponent(val);
            }
        }
        // send synchronous request to tokenize
        var req = new XMLHttpRequest();
        req.open("GET", base_svc, false);
        req.send(null);
        var tokenized = req.responseXML;
        var root = $(tokenized.documentElement);
        if ((req.status != 200) || root.is("error"))
        {
            var msg = root.is("error") ? root.text() :
                "Error tokenizing" +
                (req.responseText ? req.responseText :
                req.statusText);
            alert(msg);
            throw(msg); 
        }
        if (transform) {
            try {   
                if (req.overrideMimeType)
                    req.overrideMimeType('text/xml')
                req.open("GET", transform, false);
                req.send(null);
                if (req.status != 200)
                {
                    var msg = "Can't get token transform";
                    alert(msg);
                    throw(msg);
                }
                var transformDoc = req.responseXML;
                var transformProc= new XSLTProcessor();
                transformProc.importStylesheet(transformDoc);
                treebank = transformProc.transformToDocument(tokenized);
                var x = "test";
            } catch (a_e) {
                alert(a_e);
            }
        }
    } else {
        var sent = "<sentence" +
                  " fmt='" + fmt + "'" +
                  " xml:lang='" + lang + "'" +
                  ">" + $("textarea", form).val() +
               "</sentence>";
    }
    
    // a bit of a hack -- need to ping the api get the cookie
    var pingUrl = $("meta[name='pingurl']").attr("content");
    if (pingUrl) {
        var req = new XMLHttpRequest();
        req.open("GET", pingUrl, false);
        req.send(null);
    }

    
    var resp;
    try {
        // another hack to make AlphEdit think we've done something
        AlphEdit.pushHistory(["create"],null);
        // send synchronous request to add
        resp = AlphEdit.putContents(treebank,url,$("input[name='lang']",form).val(),'');
    } catch (a_e) {
        alert(a_e);
    }
    
   

    // save values from return in submit form
    form = $("form[name='submit-form']", document);
    var doc = null;
    var s = 1;
    if ($(resp).attr("doc")) {
        doc = $(resp).attr("doc");
        s = $(resp).attr("s");
    } else {
        doc = $(resp).text();
    }
    $("input[name='doc']", form).attr("value",doc);
    $("input[name='s']", form).attr("value", s);
    $("input[name='direction']",form).attr("value",dir);
    $("input[name='lang']",form).attr("value",lang);
    return false;
};

// Toggle tokenization options based upon input language
// for now we only support tokenization options for latin
function toggle_tokenization_options() {
    var lang = $(this).val();
    if (lang == 'lat' || lang == "la") {
        $("#tokenization-options").show();
    } else {
        $("#tokenization-options").hide();
    }
}