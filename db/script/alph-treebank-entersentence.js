/**
 * @fileoverview alph-treebank-enter - treebank entry
 *  
 * Copyright 2009 Cantus Foundation
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

function EnterSentence(a_event)
{
    // get input form and URL to use to add sentence
    var form = $("form[name='input-form']", document);
    var url = $("meta[name='url']", document).attr("content");

    // create text of sentence
    var fmt = $("#format-buttons input:checked", form).val();
    var lang = $("#lang-buttons input:checked", form).val();
    url = url + "?&fmt="+ fmt + "&lang=" + lang;
    var sent = $("textarea", form).val();
   
    // send synchronous request to add
    var req = new XMLHttpRequest();
    req.open("POST", url, false);
    req.setRequestHeader("Content-Type", "text/xml");
    req.send(sent);
    var root = $(req.responseXML.documentElement);
    if ((req.status != 200) || root.is("error"))
    {
        var msg = root.is("error") ? root.text() :
                                     "Error adding sentence to treebank:" +
                                       (req.responseText ? req.responseText :
                                                           req.statusText);
        alert(msg);
        throw(msg);
    }

    // save values from return in submit form
    form = $("form[name='submit-form']", document);
    $("input[name='doc']", form).attr("value", root.attr("doc"));
    $("input[name='s']", form).attr("value", root.attr("s"));
};
