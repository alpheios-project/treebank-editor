/**
 * @fileoverview alph-edit-utils - editor utility functions
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

/**
 * @class Alpheios editor utility functions
 */
var AlphEdit = {

//****************************************************************************
// functions to manipulate multi-valued class attribute
//****************************************************************************

/**
 * Get class attribute values
 * @param {Element} a_elt element to use
 * @returns array of class values (empty if none exist)
 * @type Array
 */
getClass : function(a_elt)
{
    var attr = a_elt.getAttributeNS(null, "class");
    return (attr ? attr.split(' ') : Array());
},

/**
 * Add value to class attribute
 * @param {Element} a_elt element to use
 * @param {String} a_class value to add
 */
addClass : function(a_elt, a_class)
{
    var classVals = this.getClass(a_elt);
    for (i in classVals)
    {
        // if class already there, nothing to do
        if (classVals[i] == a_class)
            return;
    }
    classVals.push(a_class);
    a_elt.setAttributeNS(null, "class", classVals.join(' '));
},

/**
 * Remove value from class attribute
 * @param {Element} a_elt element to use
 * @param {String} a_class value to remove
 */
removeClass : function(a_elt, a_class)
{
    // if no value specified, remove whole value
    if (!a_class)
    {
        a_elt.removeAttributeNS(null, "class");
        return;
    }

    var classVals = this.getClass(a_elt);
    for (i in classVals)
    {
        // if class there, remove it
        if (classVals[i] == a_class)
        {
            classVals.splice(i, 1);
            a_elt.setAttributeNS(null, "class", classVals.join(' '));
            return;
        }
    }
    // if not found, nothing to do
},

/**
 * Toggle value in class attribute
 * Remove value if present, add value if not present
 * @param {Element} a_elt element to use
 * @param {String} a_class value to change
 */
toggleClass : function(a_elt, a_class)
{
    // if value is present remove it
    if ($(a_elt).hasClass(a_class))
      removeClass(a_elt, a_class);
    // if not present, add it
    else
      addClass(a_elt, a_class);
},

//****************************************************************************
// history/state
//****************************************************************************

// data for history
d_history : Array(),                        // array of actions
d_historyCursor : 0,                        // position in history
d_saveCursor : 0,                           // position of last save

/**
 * Clear history
 */
clearHistory : function()
{
    this.d_history = [];
    this.d_historyCursor = 0;
    this.d_saveCursor = 0;
},

/**
 * Add event to history
 * @param {Array} a_event event
 * @param {function} a_updateCallback update callback function
 */
pushHistory : function(a_event, a_updateCallback)
{
    // destroy any redo history and adjust save points and buttons
    if (this.d_historyCursor < this.d_history.length)
    {
        this.d_history.splice(this.d_historyCursor);
        $("#redo-button", document).attr("disabled", "yes");

        // if we just destroyed save point in history
        if (this.d_saveCursor > this.d_historyCursor)
        {
          // remember that no point in history corresponds to last save
          this.d_saveCursor = -1;
          $("#save-button", document).removeAttr("disabled");
        }
    }

    // save event plus alignment state
    this.d_history.push(a_event);
    this.d_historyCursor++;

    // adjust buttons
    $("#undo-button", document).removeAttr("disabled");
    if (this.d_saveCursor == this.d_historyCursor)
      $("#save-button", document).attr("disabled", "yes");
    else
      $("#save-button", document).removeAttr("disabled");

    // update state
    if (a_updateCallback)
        a_updateCallback(a_event, 1);
},

/**
 * Return event from undo history
 * @param {function} a_updateCallback update callback function
 * @returns event from history
 * @type Array
 */
popHistory : function(a_updateCallback)
{
    // fail if no history exists
    if (this.d_historyCursor == 0)
        return null;

    // get event and disable undo button if it's last one
    var event = this.d_history[--this.d_historyCursor];
    if (this.d_historyCursor == 0)
        $("#undo-button", document).attr("disabled", "yes");

    // adjust buttons
    document.getElementById("redo-button").removeAttribute("disabled");
    if (this.d_saveCursor == this.d_historyCursor)
        $("#save-button", document).attr("disabled", "yes");
    else
        $("#save-button", document).removeAttr("disabled");

    // update state
    if (a_updateCallback)
        a_updateCallback(a_event, -1);

    return event;
},

/**
 * Return event from redo history
 * @param {function} a_updateCallback update callback function
 * @returns event from history
 * @type Array
 */
repushHistory : function(a_updateCallback)
{
    // fail if nothing to redo exists
    if (this.d_historyCursor == this.d_history.length)
        return null;

    // get event and disable redo button if it's last one
    var event = this.d_history[this.d_historyCursor++];
    if (this.d_historyCursor == this.d_history.length)
        $("#redo-button", document).attr("disabled", "yes");

    // adjust buttons
    $("#undo-button", document).removeAttr("disabled");
    if (this.d_saveCursor == this.d_historyCursor)
      $("#save-button", document).attr("disabled", "yes");
    else
      $("#save-button", document).removeAttr("disabled");

    // update state
    if (a_updateCallback)
        a_updateCallback(a_event, 1);

    return event;
},

/**
 * Note that results have been saved
 */
saved : function()
{
    this.d_saveCursor = this.d_historyCursor;
    $("#save-button", document).attr("disabled", "yes");
},

//****************************************************************************
// save
//****************************************************************************

/**
 * Check whether unsaved changes exist
 * @returns true if in-memory state does not match saved state
 * @type Boolean
 */
unsavedChanges: function()
{
    return (this.d_saveCursor != this.d_historyCursor);
},

/**
 * Save contents of SVG element by sending to save URL
 */
saveContents: function()
{
    // if nothing has changed, do nothing
    // (shouldn't ever happen because save button should be disabled)
    if (this.d_saveCursor == this.d_historyCursor)
      return;

    // send synchronous request to save
    var req = new XMLHttpRequest();
    var svg = document.getElementsByTagNameNS("http://www.w3.org/2000/svg",
                                              "svg")[0];
    req.open("POST", svg.getAttribute("alph-saveurl"), false);
    req.setRequestHeader("Content-Type", "application/xml");
    var svgxml = XMLSerializer().serializeToString(svg);
    req.send(svgxml);
    if (req.status != 200)
      alert(req.responseText ? req.responseText : req.statusText);

    // remember where we last saved and reset button
    this.saved();
},

/**
 * Get contents of sentence from database
 * @param {String} a_url URL to get sentence from
 * @param {String} a_doc document name
 * @param {String} a_sentid sentence id
 * @returns sentence
 * @type {Document}
 */
getContents: function(a_url, a_doc, a_sentid)
{
    // get treebank sentence
    var req = new XMLHttpRequest();
    req.open("GET", a_url + "?doc=" + a_doc + "&s=" + a_sentid, false);
    req.send(null);
    var root = $(req.responseXML.documentElement);
    if ((req.status != 200) || root.is("error"))
    {
        var msg = root.is("error") ? root.text() :
                                     "Error getting sentence " +
                                       a_sentid +
                                       " from treebank " +
                                       a_doc +
                                       ": " +
                                       (req.responseText ? req.responseText :
                                                           req.statusText);
        alert(msg);
        throw(msg);
    }

    return req.responseXML;
},

/**
 * Put contents of sentence back to database
 * @param {Element} a_xml sentence to put
 * @param {String} a_url URL to send sentence to
 * @param {String} a_doc document name
 * @param {String} a_sentid sentence id
 */
putContents: function(a_xml, a_url, a_doc, a_sentid)
{
    // if nothing has changed, do nothing
    // (shouldn't ever happen because save button should be disabled)
    if (this.d_saveCursor == this.d_historyCursor)
      return;

    // send synchronous request to save
    var req = new XMLHttpRequest();
    req.open("POST", a_url + "?doc=" + a_doc + "&s=" + a_sentid, false);
    req.setRequestHeader("Content-Type", "application/xml");
    req.send(XMLSerializer().serializeToString(a_xml));
    var root = $(req.responseXML.documentElement);
    if ((req.status != 200) || root.is("error"))
    {
        var msg = root.is("error") ? root.text() :
                                     "Error getting sentence " +
                                       a_sentid +
                                       " from treebank " +
                                       a_doc +
                                       ": " +
                                       (req.responseText ? req.responseText :
                                                           req.statusText);
        alert(msg);
        throw(msg);
    }

    // remember where we last saved and reset button
    this.saved();
}

}
