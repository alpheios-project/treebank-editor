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
    var dir = $("#dir-buttons input:checked",form).val();
    $("input[name='inputtext']",form).attr("dir",dir);

    // create text of sentence
    var lang = $("#lang-buttons input:checked", form).val();
    var tokenization_service = $("meta[name='tokenization_service_" + lang + "']");
    if (tokenization_service.length == 0) {
        tokenization_service = $("meta[name='tokenization_service']");
    }
    if (tokenization_service.length == 1) {
        var base_svc = tokenization_service.attr("content");
        var form_atts = tokenization_service.attr("data-params").split(' ');
        var transform = tokenization_service.attr("data-transform");
        var params = {};
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
                params[service_param] = val;
                //base_svc = base_svc + "&" + service_param + "=" + encodeURIComponent(val);
            }
        }
        var tokenized;
        // send synchronous request to tokenize
        $.ajax({
            url: base_svc,
            type: "POST",
            dataType: "xml",
            data: params,
            async: false,
            success: function(a_data) {
                tokenized = a_data;
                var root = tokenized ? $(tokenized.documentElement) : null;
                if (root ==null || root.is("error")) {
                    var msg = root.is("error") ? root.text() :
                        "Error tokenizing";
                    alert(msg);
                    throw(msg);        
                }
             
            },
            error: function(a_req,a_text,a_error) {
                alert(a_error);
                throw(a_error);   
            }
        });
        
        if (transform) {
            try {   
                var req = new XMLHttpRequest();
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
                transformProc.setParameter(null,"e_docuri",$("input[name='text_uri']").val());
                transformProc.setParameter(null,"e_lang",$("input[name='lang']").val());
                transformProc.setParameter(null,"e_format",$("input[name='format']").val());
                transformProc.setParameter(null,"e_agenturi",base_svc);
                transformProc.setParameter(null,"e_datetime",new Date().toDateString());
                // TODO should probably allow identification of collection in input
                transformProc.setParameter(null,"e_collection",'urn:cite:perseus:' + $("input[name='lang']").val() + 'tb');
                treebank = transformProc.transformToDocument(tokenized);
            } catch (a_e) {
                alert(a_e);
                return false;
            }
        }
    }
    return put_treebank(treebank);
};

function put_treebank(treebank) {
    // a bit of a hack -- need to ping the api get the cookie
    var pingUrl = $("meta[name='pingurl']").attr("content");
    if (pingUrl) {
        var req = new XMLHttpRequest();
        req.open("GET", pingUrl, false);
        req.send(null);
    }
    
    var url = $("meta[name='url']", document).attr("content");
    var resp;
    try {
        // another hack to make AlphEdit think we've done something
        AlphEdit.pushHistory(["create"],null);
        // send synchronous request to add
        resp = AlphEdit.putContents(treebank,url,'','');
    } catch (a_e) {
        alert(a_e);
        return false;
    }
    
    // save values from return in submit form
    var form = $("form[name='submit-form']", document);
    var lang = $("#lang-buttons input:checked", form).val();
    var dir = $("#dir-buttons input:checked",form).val();
    $("input[name='inputtext']",form).attr("dir",dir);

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
    return true;
}

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

function startRead(evt) {
    var file = document.getElementById("file").files[0];
    if (file) {
        var reader = new FileReader();
        reader.readAsText(file, "UTF-8");
        reader.onload = fileLoaded;
        
    }
}

function fileLoaded(evt) {
    var xml = (new DOMParser()).parseFromString(evt.target.result,"text/xml");
    var annotation = null;
     try {   
        var req = new XMLHttpRequest();
        if (req.overrideMimeType)
            req.overrideMimeType('text/xml')
        // TODO externalize path to this transformation
        req.open("GET", "../xslt/wrap_treebank.xsl", false);
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
        transformProc.setParameter(null,"e_datetime",new Date().toDateString());
        // TODO should probably allow identification of collection in input
        transformProc.setParameter(null,"e_collection",'urn:cite:perseus:');
        annotation = transformProc.transformToDocument(xml);
    } catch (a_e) {
        alert(a_e);
        return false;
    }
    if (put_treebank(annotation)) {
        $("form[name='submit-form']", document).submit();
    }
}