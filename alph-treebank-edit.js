/**
 * @fileoverview alph-treebank-edit - treebank editor
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

var s_svgns = "http://www.w3.org/2000/svg";     // svg namespace
var s_xlinkns = "http://www.w3.org/1999/xlink"; // xlink namespace

var s_getSentenceURL = null;          // where to get treebank sentence from
var s_putSentenceURL = null;          // where to put modified treebank sentence
var s_editTransform = null;           // transform between SVG and XML, etc.
var s_editTransformDoc = null;        // transform document
var s_params = null;                  // treebank parameters
var s_direction = null;               // text direction

var s_showExpansionControls = true;
var s_contractionSymbol = "-";
var s_expansionSymbol = "+";

var s_currentId = null;               // current target id
var s_currentArcLabelId = null;       // id of current arc label
var s_dragId = null;                  // dragged word id
var s_dragObj = null;                 // object being dragged
var s_dragStartTrans = null;          // initial transform of group
var s_dragTransX = 0;                 // X translation of group
var s_dragTransY = 0;                 // Y translation of group
var s_dragX = 0;                      // mouse X
var s_dragY = 0;                      // mouse Y

var s_firebug = true;                 // using firebug
var s_firefox = false;                // in Firefox
var s_mode = "tree";                  // edit mode: tree/label/ellipsis

// table of [key, char, modifiers, function, arg]
// where modifiers is four-char string acsm, where
//    a = 1 if altKey else 0
//    c = 1 if ctrlKey else 0
//    s = 1 if shiftKey else 0
//    m = 1 if metaKey else 0
//   
var s_keyTable =
[
    [  0, 104, "0000", traverseTreeLeft,  null],        // h
    [  0, 108, "0000", traverseTreeRight, null],        // l
    [  0, 106, "0000", traverseTreeDown,  null],        // j
    [  0, 107, "0000", traverseTreeUp,    null],        // k
    [ 27,   0, "0000", DoAbortAction,     null],        // <ESC>
    [112,   0, "0100", DoSetMode,         "tree"],      // ctrl-F1
    [113,   0, "0100", DoSetMode,         "label"],     // ctrl-F2
    [114,   0, "0100", DoSetMode,         "ellipsis"],  // ctrl-F3
    [  0, 121, "0100", ClickOnRedo,       null],        // ctrl-y
    [  0, 122, "0100", ClickOnUndo,       null]         // ctrl-z
];

//****************************************************************************
// initialization
//****************************************************************************

/**
 * Initialize tree structure
 * Create any missing elements
 * Bind event handlers
 * Position elements
 * @param {Event} a_event event
 */
function Init(a_event)
{
    try
    {
        // modify html based on metadata flags
        var flag = $("meta[name='alpheios-sentenceNavigation']", document);
        if (flag.size() == 0)
            $("div#sent-navigation", document).remove();

        // set state variables
        if (navigator.userAgent.indexOf("Firefox") != -1)
            s_firefox = true;
        var form = $("form[name='sent-edit-mode']", document); 
        if (form.size() > 0)
            s_mode = $("input[checked]", form).attr("value");
        $("body", document).attr("alpheios-mode", s_mode);

        // get parameters from call
        s_params = location.search.substr(1).split("&");
        var numParams = s_params.length;
        for (i in s_params)
        {
            s_params[i] = s_params[i].split("=");
            s_params[s_params[i][0]] = s_params[i][1];
        }
        s_params["numParams"] = numParams;

        // get treebank transform
        var req = new XMLHttpRequest();
        if (req.overrideMimeType)
            req.overrideMimeType('text/xml')
        req.open("GET",
                 $("meta[name='alpheios-editTransformURL']",
                   document).attr("content"),
                 false);
        req.send(null);
        if (req.status != 200)
        {
            var msg = "Can't get SVG transform";
            alert(msg);
            throw(msg);
        }
        s_editTransformDoc = req.responseXML;
        s_editTransform = new XSLTProcessor();
        s_editTransform.importStylesheet(s_editTransformDoc);

        // get info about treebank
        var getInfoURL = $("meta[name='alpheios-getInfoURL']",
                           document).attr("content");
        if (getInfoURL)
        {
            // build list of content to be built
            var toBuild = $("meta[name='alpheios-buildContent']",
                            document).attr("content");
            toBuild = (toBuild && toBuild.length) ? toBuild.split(' ') : [];
            for (i in toBuild)
                toBuild[toBuild[i]] = toBuild[i];

            // get info on format
            req.open("GET",
                     getInfoURL +
                        "?doc=" + s_params["doc"] +
                        ((toBuild.length > 0) ? "&desc=y" : ""),
                     false);
            req.send(null);
            var root = $(req.responseXML.documentElement);
            if ((req.status != 200) || root.is("error"))
            {
                var msg = root.is("error") ?
                            root.text() :
                            "Error getting info for treebank " + s_params["doc"];
                alert(msg);
                throw(msg);
            }

            // save treebank attributes
            s_params["maxSentId"] = Number(root.attr("numSentences"));
            s_params["lang"] = root.attr("xml:lang");
            s_direction = root.attr("direction");

            // build various content
            if (toBuild["menus"])
            {
                s_editTransform.setParameter(null, "e_mode", "menus");
                var menus =
                        s_editTransform.transformToDocument(req.responseXML);
                var menuContent = $(menus.documentElement).children();
                $("form[name='menus']", document).append(menuContent);
            }
            if (toBuild["style"])
            {
                s_editTransform.setParameter(null, "e_mode", "style");
                var style =
                        s_editTransform.transformToDocument(req.responseXML);
                var styleRules = $(style).text().split('\n');
                for (i in styleRules)
                    document.styleSheets[0].insertRule(styleRules[i], 0);
            }
            if (toBuild["key"])
            {
                s_editTransform.setParameter(null, "e_mode", "key");
                var key = s_editTransform.transformToDocument(req.responseXML);
                var keyContent = $(key.documentElement);
                $("div#key", document).append(keyContent);
            }
        }
        else
        {
            // get values from html
            s_params["maxSentId"] =
                Number($("meta[name='alpheios-numSentences']", document).
                       attr("content"));
            s_params["lang"] =
                $("meta[name='alpheios-lang']", document).attr("content");
            s_params["direction"] =
                $("meta[name='alpheios-direction']", document).attr("content");
        }

        // fix various values in html
        var exitForm = $("form[name='sent-navigation-exit']", document);
        var exitURL = $("meta[name='alpheios-exitURL']", document);
        var exitLabel = $("meta[name='alpheios-exitLabel']", document);
        exitForm.attr("action", exitURL.attr("content"));
        $("input[name='doc']", exitForm).attr("value", s_params["doc"]);
        $("button", exitForm).text(exitLabel.attr("content"));
        $("html", document).attr("xml:lang", s_params["lang"]);
        $("svg", document).attr("alph-doc", s_params["doc"]);

        // get URLs from header
        s_getSentenceURL =
          $("meta[name='alpheios-getSentenceURL']", document).attr("content");
        s_putSentenceURL =
          $("meta[name='alpheios-putSentenceURL']", document).attr("content");

        // go to new sentence
        InitNewSentence();
    }
    catch(e)
    {
        Log(e);
    }

    // onresize doesn't work in firefox, so register it here
    window.addEventListener("resize", Resize, false);
};

/**
 * Initialize new sentence
 */
function InitNewSentence()
{
    // clear undo/redo history
    AlphEdit.clearHistory();

    // get and transform treebank sentence
    var sentence = AlphEdit.getContents(s_getSentenceURL,
                                        s_params["doc"],
                                        s_params["s"]);
    var root = $(sentence.documentElement);
    s_params["document_id"] = root.attr("document_id");
    s_params["subdoc"] = root.attr("subdoc");
    s_editTransform.setParameter(null, "e_mode", "xml-to-svg");
    var svg = s_editTransform.transformToDocument(sentence);
    $("svg", document).empty().append($(svg.documentElement).children());

    // sentence id in <svg>
    $("svg", document).attr("alph-sentid", s_params["s"]);

    // fix numeric sentence number
    s_params["snum"] = Number(s_params["s"]);
    if (isNaN(s_params["snum"]))
        s_params["snum"] = 1;
    else if (s_params["snum"] <= 0)
        s_params["snum"] = 1;
    if (s_params["snum"] > s_params["maxSentId"])
        s_params["snum"] = s_params["maxSentId"];

    var s = s_params["snum"];
    var maxSentId = s_params["maxSentId"];

    // first sentence button
    var button = $("#first-button", document);
    if (s <= 1)
        button.attr("disabled", "disabled");
    else
        button.removeAttr("disabled");
    button.attr("value", "1");
    button.text("1" + "\u00A0\u25C2\u25C2");

    // previous sentence button
    button = $("#prev-button", document);
    button.attr("value", s - 1);
    if (s <= 1)
        button.attr("disabled", "disabled");
    else
        button.removeAttr("disabled");
    if (s <= 1)
        button.text("1" + "\u00A0\u25C2");
    else
        button.text((s - 1) + "\u00A0\u25C2");
    $("#current-label", document).text(s);

    // next sentence button
    button = $("#next-button", document);
    button.attr("value", s + 1);
    if (s >= maxSentId)
        button.attr("disabled", "disabled");
    else
        button.removeAttr("disabled");
    if (s >= maxSentId)
        button.text("\u25B8\u00A0" + maxSentId);
    else
        button.text("\u25B8\u00A0" + (s + 1));

    // last sentence button
    button = $("#last-button", document);
    button.attr("value", maxSentId);
    if (s >= maxSentId)
        button.attr("disabled", "disabled");
    else
        button.removeAttr("disabled");
    button.text("\u25B8\u25B8\u00A0" + maxSentId);

    // html fixes
    $("head title", document).text("Alpheios:Edit Treebank Sentence: " +
                                   s_params["document_id"] +
                                   ": " +
                                   s_params["subdoc"]);
    $("form[name='sent-navigation-exit'] input[name='s']",
      document).attr("value", s_params["s"]);

    // set initial state of controls
    $("form[name='sent-navigation-goto'] input", document).removeAttr("value");
    $("#expansion-checkbox", document).attr("checked", "checked");
    s_showExpansionControls = true;

    // right-to-left doesn't seem to be working in firefox svg
    // reverse strings by hand, but ignore strings containing digits
    if (s_firefox && (s_direction == "rtl"))
    {
        $("text.node-label, text.text-word", document).each(
        function()
        {
            var thisNode = $(this);
            var text = thisNode.text();
            if (text.match(/^[^0-9]*$/))
            {
                // if this is node, save original form
                if (thisNode.is(".node-label"))
                    thisNode.attr("form", text);

                // if starts with nbsp, move it to end
                if (text.charAt(0) == '\u00A0')
                    text = text.substr(1) + '\u00A0';
                thisNode.text(text.split("").reverse().join(""));
            }
        });
    }

    // for each elided node
    $("g[elided]", document).each(
    function(i)
    {
        // set index and label to i
        $(this).attr("elided", i);
        $("> text.node-label", this).text("[" + i + "]");

        // set id from first word in subtree
        var words = $(this).find("g.tree-node:not([elided])");
        var first = words.get(0);
        words.each(
        function ()
        {
            if (compareById(first, this) > 0)
                first = this;
        });
        $(this).attr("id", $(first).attr("id") + "-" + i);
    });

    // initialize handlers
    InitHandlers(document, false);

    // for text group
    $("g.text", document).each(
    function()
    {
        // turn off highlighting when we leave
        $(this).bind(
            "mouseleave",
            function() { highlightWord(this.ownerDocument, null); }
        );
    });

    // bind mouse events
    $("body", document).bind("click", Click);
    $("body", document).bind("mousemove", Drag);

    // set/reset buttons
    $("#undo-button", document).attr("disabled", "disabled");
    $("#redo-button", document).attr("disabled", "disabled");
    $("#save-button", document).attr("disabled", "disabled");

    Reposition();
};

/**
 * Initialize handlers for node or nodes
 * @parameter {Node} a_node root node
 * @parameter {Boolean} a_single whether to do single node
 */
function InitHandlers(a_node, a_single)
{
    var prefix = a_single ? "> ": "";

    // for each text word
    $(prefix + "text.text-word", a_node).each(
    function()
    {
        var thisNode = $(this);
        var tbrefid = thisNode.attr("tbref");

        // turn on highlighting for the word
        thisNode.bind(
            "mouseenter",
            function()
            {
                if (s_dragObj)
                {
                    // if we're dragging and this node is descendant
                    // don't highlight
                    var dragRoot = $("#" + s_dragId, document);
                    var treeNode = $("#" + tbrefid, document);
                    if (treeNode.parents().andSelf().index(dragRoot) >= 0)
                        return;
                }
                highlightWord(this.ownerDocument, tbrefid);
            }
        );
    });

    // for each label
    $(prefix + "text.node-label, " + prefix + "rect.highlight", a_node).each(
    function()
    {
        var thisNode = $(this);
        // highlight the word while hovering
        var id = thisNode.parent().attr("id");
        thisNode.hover(
            function()
            {
                if (s_dragObj)
                {
                    // if we're dragging and this node is descendant
                    // don't highlight
                    var dragRoot = $("#" + s_dragId, document);
                    if ($(this).parents().andSelf().index(dragRoot) >= 0)
                        return;
                }
                highlightWord(this.ownerDocument, id);
            },
            function() { highlightWord(this.ownerDocument, null); }
        );
    });

    // for each arc highlight
    $(prefix + "text.arc-label, " + prefix + "rect.arc-highlight",
      a_node).each(
    function()
    {
        // highlight while hovering
        $(this).hover(
            function()
            {
                if (s_mode == "label")
                {
                    var label =
                        $(this).parent().children("rect.arc-highlight");
                    AlphEdit.addClass(label[0], "hovering");
                }
            },
            function()
            {
                var label =
                      $(this).parent().children("rect.arc-highlight");
                AlphEdit.removeClass(label[0], "hovering"); }
        );
    });

    // for each expansion control
    $(prefix + "g.expand", a_node).each(
    function()
    {
        // highlight while hovering
        $(this).hover(
            function()
            {
                if (!s_dragObj)
                    this.setAttribute("showme", "focus");
            },
            function() { this.setAttribute("showme", "normal"); }
        );
    });

    // bind mouse events
    $(prefix + "text.text-word, " + prefix + "text.node-label",
      a_node).bind("mouseover", Enter);
    $(prefix + "text.text-word, " + prefix + "text.node-label",
      a_node).bind("mouseout", Leave);
    $(prefix + "text.arc-label", a_node).bind("click", ClickOnArcLabel);
    $(prefix + "g.expand rect, " + prefix + "g.expand text", a_node).each(
    function()
    {
        $(this).attr("pointer-events", "all");
        $(this).bind("click", Expand);
    });
};

/**
 * Log message to console
 * @param {String} a_msg message to send
 */
function Log(a_msg)
{
    if (s_firebug)
        console.log(a_msg);
};

//****************************************************************************
// event handlers
//****************************************************************************

/**
 * Event handler for mouseover
 * @param {Event} a_event the event
 */
function Enter(a_event)
{
    var target = AlphEdit.getEventTarget(a_event);

    // if over word
    if ($(target).hasClass("node-label"))
    {
        s_currentId = $(target.parentNode).attr("id");
    }
    else if ($(target).hasClass("text-word"))
    {
        s_currentId = $(target).attr("tbref");
    }

    Log("Enter " + s_currentId);
};

/**
 * Event handler for mouseout
 * @param {Event} a_event the event
 */
function Leave(a_event)
{
    var target = AlphEdit.getEventTarget(a_event);

    // if over word
    if ($(target).filter(".node-label, .text-word"))
    {
        Log("Leave " + s_currentId);
        s_currentId = null;
    }
};

/**
 * Event handler for mouse click
 * @param {Event} a_event the event
 */
function Click(a_event)
{
    var event = AlphEdit.getEvent(a_event);

    switch (s_mode)
    {
      case "tree":
        (s_dragObj ? Drop(event) : Grab(event));
        break;

      case "ellipsis":
        DoElidedNode();
    }
};

/**
 * Event handler for picking up word/subtree
 * @param {Event} a_event the event
 */
function Grab(a_event)
{
    var event = AlphEdit.getEvent(a_event);
    var target = AlphEdit.getEventTarget(event);

    Log("Grab");

    // if grabbed word, either in tree or in text
    if ($(target).hasClass("node-label") ||
        $(target).hasClass("text-word"))
    {
        if ($(target).hasClass("node-label"))
        {
            s_dragObj = target.parentNode;
            s_dragId = $(s_dragObj).attr("id");
        }
        else
        {
            s_dragObj = $(target).clone(true)[0];
            $(target.parentNode).append(s_dragObj);
            s_dragId = $(s_dragObj).attr("tbref");
        }
        AlphEdit.addClass($("#dependency-tree", document)[0], "dragging");
        AlphEdit.addClass(s_dragObj, "dragging");
        highlightWord(s_dragObj.ownerDocument, null);
        s_dragStartTrans = s_dragObj.getAttribute("transform");
        s_dragX = event.pageX;
        s_dragY = event.pageY;
        var pref = "translate(";
        if (s_dragStartTrans &&
            (s_dragStartTrans.substring(0, pref.length) == pref))
        {
            var startX = pref.length;
            var endX = s_dragStartTrans.indexOf(",");
            var endY = s_dragStartTrans.indexOf(")");
            s_dragTransX = Number(s_dragStartTrans.substring(startX, endX));
            s_dragTransY = Number(s_dragStartTrans.substring(endX + 1, endY));
            var line = $(s_dragObj).children("line");
            var lineX = line[0].getAttribute("x2");
            line[0].setAttribute("x1", lineX);
            if (line.size() > 0)
            {
                s_dragTransX += Number(line[0].getAttribute("x2"));
                s_dragTransX -= Number(line[0].getAttribute("x1"));
                s_dragTransY += Number(line[0].getAttribute("y2"));
                s_dragTransY -= Number(line[0].getAttribute("y1"));
            }
            var arcLabel = $(s_dragObj).children("text.arc-label")[0];
            arcLabel.setAttribute("x", lineX - 2);
            arcLabel.setAttribute("text-anchor", "end");
        }
        else
        {
            s_dragStartTrans = null;
            s_dragTransX = 0;
            s_dragTransY = 0;
        }
        Log("Grabbed " + s_dragId);
    }
};

/**
 * Event handler for moving word/subtree
 * @param {Event} a_event the event
 */
function Drag(a_event)
{
    var event = AlphEdit.getEvent(a_event);

    // if we're dragging something
    if (s_dragObj)
    {
        var scale = s_dragObj.ownerSVGElement.currentScale;
        var trans = s_dragObj.ownerSVGElement.currentTranslate;
        var newX = (event.pageX - trans.x) / scale;
        var newY = (event.pageY - trans.y) / scale;

        // if we've moved, update transform
        if ((newX != s_dragX) || (newY != s_dragY))
        {
            s_dragTransX += (newX - s_dragX);
            s_dragTransY += (newY - s_dragY);
            s_dragX = newX;
            s_dragY = newY;
            // note: +20 ensures that group draws below cursor so we
            // can mouse over other nodes, regardless of Z order
            var newTransform = "translate(" + s_dragTransX + ", " +
                                              (s_dragTransY + 20) + ")";
            s_dragObj.setAttributeNS(null, "transform", newTransform);
        }
        Log("Dragging to (" + s_dragX + ", " + s_dragY + ")");
    }
};

/**
 * Event handler for dropping word/subtree
 * @param {Event} a_event the event
 */
function Drop(a_event)
{
    Log("Drop");

    // if dropping on a word
    // (null a_event means we're aborting)
    if (a_event && s_currentId)
    {
        // ignore word if it's in subtree being dragged
        // but don't stop dragging
        var dragRoot = $("#" + s_dragId, document);
        var currentNode = $("#" + s_currentId, document);
        if (currentNode.parents().andSelf().index(dragRoot) >= 0)
        {
            Log("Dragging continued");
            return;
        }

        // move node
        DoMove(s_dragId, s_currentId, true);
    }
    else
    {
        Log("Dropping abandoned");
    }

    // restore to original position, if any
    if (s_dragStartTrans)
        s_dragObj.setAttributeNS(null, "transform", s_dragStartTrans);
    else
        s_dragObj.removeAttributeNS(null, "transform");

    if ($(s_dragObj).filter("text").size() > 0)
        $(s_dragObj).remove();
    else
        AlphEdit.removeClass(s_dragObj, "dragging");
    AlphEdit.removeClass($("#dependency-tree", document)[0], "dragging");
    s_dragObj = null;
    s_dragId = null;

    Reposition();
};

/**
 * Event handler for clicking on expansion control
 * @param {Event} a_event the event
 */
function Expand(a_event)
{
    var event = AlphEdit.getEvent(a_event);
    var target = AlphEdit.getEventTarget(event);

    // if we're dragging, treat it like a drop
    if (s_dragObj)
    {
        Drop(event);
        return;
    }

    var node = target.parentNode.parentNode;
    var expanded = $(node).attr("expanded");

    // set new expansion
    DoExpand(node.getAttribute("id"),
             (expanded == "yes") ? "no" : "yes",
             true);

    // redraw tree
    Reposition();
};

/**
 * Event handler for undo operation
 * @param {Event} a_event the event
 */
function ClickOnUndo(a_event)
{
    ReplayEvent(AlphEdit.popHistory(null), false);
};

/**
 * Event handler for redo operation
 * @param {Event} a_event the event
 */
function ClickOnRedo(a_event)
{
    ReplayEvent(AlphEdit.repushHistory(null), true);
};

/**
 * Event handler for toggling display of expansion controls
 * @param {Event} a_event the event
 */
function ShowExpansionControls(a_event)
{
    s_showExpansionControls =
            ($("#expansion-checkbox:checked", document).size() > 0);
    $("g.tree-node", document).attr("expanded", "yes");
    $("g.expand", document).
        attr("visibility", s_showExpansionControls ? "visible" : "hidden");
    Reposition();
};

/**
 * Event handler for clicking on arc label
 * @param {Event} a_event the event
 */
function ClickOnArcLabel(a_event)
{
    // only allow if in label editing mode
    if (s_mode != "label")
        return;

    var event = AlphEdit.getEvent(a_event);
    var target = AlphEdit.getEventTarget(event);
    var label = $(target.parentNode);
    s_currentArcLabelId = label.attr("id");

    var div = $("#arc-label-menus", document);
    div.find("form div").text(
        "Change " + label.children("text.arc-label").text() + " to:");
    var scroll =
    [
        document.body.scrollLeft ? document.body.scrollLeft :
                                   document.documentElement.scrollLeft,
        document.body.scrollTop ? document.body.scrollTop :
                                  document.documentElement.scrollTop,
        document.body.scrollRight ? document.body.scrollRight :
                                   document.documentElement.scrollRight,
        document.body.scrollBottom ? document.body.scrollBottom :
                                     document.documentElement.scrollBottom
    ];
    div.css("display", "none");
    div.css("left", (event.clientX + scroll[0] - 7) + "px");
    div.css("top", (event.clientY + scroll[1] + 7 - div.height()) + "px");
    div.css("display", "block");
};

/**
 * Event handler for label menu
 * @param {Event} a_event the event
 */
function ClickOnLabelButton(a_event)
{
    // hide menu
    var div = $("#arc-label-menus", document);
    div.css("display", "none");

    var target = AlphEdit.getEventTarget(a_event);
    if ($(target).is("#arc-label-apply"))
    {
        var newLabel = "";
        var label = $('select[name="arcrel1"]', div);
        if (label.size() > 0)
            newLabel += label[0].value;
        label = $('select[name="arcrel2"]', div);
        if (label.size() > 0)
            newLabel += label[0].value;
        DoLabelArc(s_currentArcLabelId, newLabel, true);
        Reposition();
    }
    
    s_currentArcLabelId = null;
};

/**
 * Event handler for save operation
 * @param {Event} a_event the event
 */
function ClickOnSave(a_event)
{
    DoSave();
};

/**
 * Event handler for window resize
 * @param {Event} a_event the event
 */
function Resize(a_event)
{
    // force full repositioning of elements
    Reposition();
};

/**
 * Event handler for exit form
 * @param {Element} a_form the form
 */
function SubmitExit(a_form)
{
    // if there are unsaved changes
    if (AlphEdit.unsavedChanges())
    {
        if (confirm("Save changes before continuing?"))
            DoSave();
    }

    return true;
};

/**
 * Event handler for form submission of jump to new sentence
 * @param a_form the form
 */
function SubmitGoTo(a_form)
{
    // if value is out of bounds
    if ((Number(a_form.s.value) <= 0) ||
        (Number(a_form.s.value) > s_params["maxSentId"]))
    {
        alert("Sentence must between 1 and " + s_params["maxSentId"]);
        return false;
    }

    // if there are unsaved changes
    if (AlphEdit.unsavedChanges())
    {
        if (confirm("Save changes before going to new sentence?"))
            DoSave();
    }

    // go to new sentence
    s_params["s"] = a_form.s.value;
    InitNewSentence();

    // always return false - we've already done the action
    return false;
};

/**
 * Event handler for button to go to new sentence
 * @param {Event} a_event the event
 */
function ClickOnGoTo(a_event)
{
    // if there are unsaved changes
    if (AlphEdit.unsavedChanges())
    {
        if (confirm("Save changes before going to new sentence?"))
            DoSave();
    }

    // go to new sentence
    s_params["s"] = AlphEdit.getEventTarget(a_event).value;
    InitNewSentence();
};

/**
 * Event handler for mode buttons
 * @param {Event} a_event the event
 */
function ClickOnMode(a_event)
{
    DoSetMode(AlphEdit.getEventTarget(a_event).value);
};

function DoSetMode(a_mode)
{
    // set mode
    s_mode = a_mode;
    $("body", document).attr("alpheios-mode", s_mode);

    // make sure buttons reflect mode
    var modeForm = $("form[name='sent-edit-mode']", document);
    $("[checked]", modeForm).removeAttr("checked");
    $("[value='" + s_mode + "']", modeForm).attr("checked", "checked");
};

/**
 * Event handler for key presses
 * @param {Event} a_event the event
 */
function Keypress(a_event)
{
    var event = AlphEdit.getEvent(a_event);

    var keyCode = event.keyCode ? event.keyCode : 0;
    var charCode = event.charCode ? event.charCode : 0;
    var modifiers = (event.altKey ? "1" : "0") +
                    (event.ctrlKey ? "1" : "0") +
                    (event.shiftKey ? "1" : "0") +
                    (event.metaKey ? "1" : "0");
    Log("Key [" + keyCode + ", " + charCode + ", " + modifiers + "]");
    for (var i = 0; i < s_keyTable.length; ++i)
    {
        if ((s_keyTable[i][0] == keyCode) &&
            (s_keyTable[i][1] == charCode) &&
            (s_keyTable[i][2] == modifiers))
        {
            s_keyTable[i][3](s_keyTable[i][4]);
            return;
        }
    }
};

//****************************************************************************
// actions
//****************************************************************************

/**
 * Move node in tree
 * @param {String} a_moveId id of element to move
 * @param {String} a_newHeadId id new head element
 * @param {Boolean} a_push whether to push event onto history
 */
function DoMove(a_moveId, a_newHeadId, a_push)
{
    Log("Moving " + a_moveId + " to " + a_newHeadId);

    // get node to move and current head id
    var moveNode = $("#" + a_moveId, document);
    var oldHeadId = moveNode.parent().attr("id");
    if (oldHeadId == a_newHeadId)
    {
        Log("Null move");
        return;
    }

    var newHeadNode = $("#" + a_newHeadId, document);
    newHeadNode.append(moveNode);

    // push event if requested
    if (a_push)
    {
        AlphEdit.pushHistory(
                    Array("move", Array(a_moveId, oldHeadId, a_newHeadId)),
                    null);
    }
};

/**
 * Expand/contract node in tree
 * @param {String} a_id id of element to change
 * @param {String} a_expand "yes" to expand, else contract
 * @param {Boolean} a_push whether to push event onto history
 */
function DoExpand(a_id, a_expand, a_push)
{
    Log((a_expand == "yes") ? "Expanding " : "Contracting ", a_id);

    // set new expansion
    var node = $("#" + a_id, document);
    node.attr("expanded", a_expand);

    // push event if requested
    if (a_push)
    {
        AlphEdit.pushHistory(Array("expand", Array(a_id, a_expand)), null);
    }
};

/**
 * Change label on arc
 * @param {String} a_id id of element to change
 * @param {String} a_label new label
 * @param {Boolean} a_push whether to push event onto history
 */
function DoLabelArc(a_id, a_label, a_push)
{
    var arcLabel = $("#" + a_id + " > text.arc-label", document);
    var oldLabel = arcLabel.text();

    // if new label
    if (oldLabel != a_label)
    {
        Log("Label " + a_id + " as " + a_label);

        arcLabel.text(a_label);

        // push event if requested
        if (a_push)
        {
            AlphEdit.pushHistory(Array("arc", Array(a_id, oldLabel, a_label)),
                                 null);
        }
    }
    // if same label
    else
    {
        Log("Label " + a_id + " unchanged");
    }
};

/**
 * Perform elided node action
 */
function DoElidedNode()
{
    // do nothing if not over a node
    if (!s_currentId)
        return;

    if ($("#" + s_currentId, document).attr("elided"))
        DoDelElidedNode(true);
    else
        DoAddElidedNode(true);

    Reposition();
};

/**
 * Destroy elided node
 * @param {Boolean} a_push whether to push event onto history
 */
function DoDelElidedNode(a_push)
{
    var currentNode = $("#" + s_currentId, document);
    s_currentId = null;
    var parent = currentNode.parent();
    var args = [currentNode.attr("id"),
                parent.attr("id"),
                currentNode.attr("elided"),
                currentNode.children("text.arc-label").text()];
    var children = currentNode.children("g.tree-node");
    children.appendTo(parent);
    currentNode.remove();

    // push event if requested
    if (a_push)
    {
        // add list of child ids
        children.each(
        function()
        {
            args.push($(this).attr("id"));
        });

        AlphEdit.pushHistory(Array("del", args, null));
    }
};

/**
 * Create elided node
 * @param {Boolean} a_push whether to push event onto history
 */
function DoAddElidedNode(a_push)
{
    var currentNode = $("#" + s_currentId, document);
    s_currentId = null;

    // can't add node above root
    if (!currentNode.parent().is(".tree-node"))
        return;

    // find lowest unused elided node number
    // there has to be one between 0 and #elided
    var elided = $("g[elided]", document);
    var i;
    for (i = 0; i <= elided.size(); ++i)
    {
        if (!elided.is("[elided = '" + i + "']"))
            break;
    }

    // create new elided node
    var newNode = $(document.createElementNS(s_svgns, "g"));
    AlphEdit.addClass(newNode[0], "tree-node");
    newNode.attr("elided", i);
    newNode.attr("expanded", "yes");

    // set id from first word in subtree
    var words = currentNode.find("g.tree-node:not([elided])").andSelf();
    var first = words.get(0);
    words.each(
    function ()
    {
        if (compareById(first, this) > 0)
            first = this;
    });
    newNode.attr("id", $(first).attr("id") + "-" + i);

    // clone displayable children from current node
    var children;
    var displayableChildren =
        currentNode.children("rect, line, text, g.expand");

    // add displayable children to new node
    displayableChildren.clone().appendTo(newNode);
    newNode.children("text.arc-label").text("nil");
    newNode.children("text.node-label").text("[" + i + "]");
    newNode.find("> g.expand text").text(s_contractionSymbol);
    newNode.find("text.node-label").removeAttr("pos");

    // add node to tree
    newNode.appendTo(currentNode.parent());
    currentNode.appendTo(newNode);

    // add handlers
    InitHandlers(newNode, true);

    // push event if requested
    if (a_push)
    {
        AlphEdit.pushHistory(
            Array("add", Array(currentNode.attr("id"), i)), null);
    }
};

/**
 * Recreate elided node
 * @param {Number} a_elided elided node number
 * @param {String} a_label arc label
 * @param {Array} a_childIds children to add to new node
 */
function DoReAddElidedNode(a_elided, a_label, a_childIds)
{
    // we are recreating a previously
    // deleted node that will be child of current node
    var parentNode = $("#" + s_currentId, document);
    s_currentId = null;

    // create new elided node
    var newNode = $(document.createElementNS(s_svgns, "g"));
    AlphEdit.addClass(newNode[0], "tree-node");
    newNode.attr("elided", a_elided);
    newNode.attr("expanded", "yes");

    // get child subtrees/nodes
    var childIds = "";
    for (i in a_childIds)
        childIds += ((i > 0) ? ", " : "") + "#" + a_childIds[i] + " ";

    // set id from first word in subtree
    var children = parentNode.find(childIds);
    var words = children.find("g.tree-node:not([elided])").andSelf();
    var first = words.get(0);
    words.each(
    function ()
    {
        if (compareById(first, this) > 0)
            first = this;
    });
    newNode.attr("id", $(first).attr("id") + "-" + a_elided);

    // clone displayable children from first child
    var displayableChildren =
          children.eq(0).children("rect, line, text, g.expand");

    // add displayable children to new node
    displayableChildren.clone().appendTo(newNode);
    newNode.children("text.arc-label").text(a_label);
    newNode.children("text.node-label").text("[" + a_elided + "]");
    newNode.find("> g.expand text").text(s_contractionSymbol);
    newNode.find("text.node-label").removeAttr("pos");

    // add node to tree
    newNode.appendTo(parentNode);
    children.appendTo(newNode);

    // add handlers
    InitHandlers(newNode, true);
};

/**
 * Save contents
 */
function DoSave()
{
    // transform sentence
    s_editTransform.setParameter(null, "e_mode", "svg-to-xml");
    var doc = document.implementation.createDocument("", "", null);
    doc.appendChild(doc.importNode($("svg", document).get(0), true));
    var xml = s_editTransform.transformToDocument(doc);

    AlphEdit.putContents(xml.documentElement,
                         s_putSentenceURL,
                         s_params["doc"],
                         s_params["s"]);
};

/**
 * Abort current action
 */
function DoAbortAction()
{
    // if labeling arc
    if (s_mode == "label")
    {
        // hide menu
        var div = $("#arc-label-menus", document);
        div.css("display", "none");
        s_currentArcLabelId = null;
    }
    // if dragging
    else if (s_mode == "tree")
    {
        // drop outside of node
        Drop(null);
    }
};

//****************************************************************************
// reposition elements
//****************************************************************************

/**
 * Reposition everything in tree
 */
function Reposition()
{
    var svgXML = $("#dependency-tree", document);
    var rootNode = svgXML.children("g.tree").children("g.tree-node").eq(0);
    show_tree(rootNode, true);

    var fontSize = 20;
    var treeSize = positionTree(rootNode, fontSize)[0];
    var maxWidth = treeSize[0];
    var textSize = positionText(document, maxWidth, fontSize);
    positionAll(document, treeSize, textSize, fontSize);
};

/**
 * Replay event from history
 * @param {Array} a_hEvent history event to replay
 * @param {Boolean} a_forward whether we're playing forward or backward
 */
function ReplayEvent(a_hEvent, a_forward)
{
    // if no event, do nothing
    if (!a_hEvent)
        return;

    // abandon any dragging operation
    s_currentId = null;
    if (s_dragObj)
        Drop();

    // interpret event
    var eventType = a_hEvent[0];
    var eventArgs = a_hEvent[1];
    switch (eventType)
    {
      case "arc":
        // relabel arc
        // event args are (id, old label, new label)
        DoLabelArc(eventArgs[0],
                   a_forward ? eventArgs[2] : eventArgs[1],
                   false);
        break;

      case "expand":
        // expand/contract node
        // event args are (id, "yes"/"no")
        // ignore if expansion controls are not enabled
        if (s_showExpansionControls)
        {
            // if going forwards, use event argument
            // if going backwards, reverse the action
            var expanded = eventArgs[1];
            if (!a_forward)
                expanded = (expanded == "yes") ? "no" : "yes";
            DoExpand(eventArgs[0], expanded, false);
        }
        break;

      case "move":
        // adjust attachment
        // event args are (id being moved, old parent, new parent)
        // if replaying forward, move to new parent
        // if replaying backward, move to old parent
        DoMove(eventArgs[0], a_forward ? eventArgs[2] : eventArgs[1], false);
        break;

      case "add":
        // add elided node
        if (a_forward)
        {
            s_currentId = eventArgs[0];
            DoAddElidedNode(false);
        }
        else
        {
            s_currentId =
                $("[elided='" + eventArgs[1] + "']", document).attr("id");
            DoDelElidedNode(false);
        }
        break;

      case "del":
        // delete elided node
        if (a_forward)
        {
            s_currentId = eventArgs[0];
            DoDelElidedNode(false);
        }
        else
        {
            s_currentId = eventArgs[1];
            DoReAddElidedNode(eventArgs[2],
                              eventArgs[3],
                              eventArgs.slice(4),
                              false);
        }
        break;

      default:
        // ignore unknown type
    }

    // reposition everything
    Reposition();
};

//****************************************************************************
// functions to manipulate tree
//****************************************************************************

/**
 * Recursively set visibility of (sub-)tree
 * @param {Element} a_container group containing tree
 * @param {Boolean} a_visible whether root of subtree is visible
 */
function show_tree(a_container, a_visible)
{
    // set root visibility
    a_container.attr("visibility", a_visible ? "visible" : "hidden");

    // subtrees are visible if root is visible and expanded
    var showSubtrees = (a_visible && (a_container.attr("expanded") == "yes")); 

    $(a_container).children("g.tree-node").each(
    function()
    {
        show_tree($(this), showSubtrees);
    });
};

/**
 * Recursively position elements of (sub-)tree
 * @param {Element} a_container group containing tree
 * @param {int} a_fontSize size of font in pixels
 * @return size of tree, center line of root element, and width of root node
 * @type Array
 */
function positionTree(a_container, a_fontSize)
{
    // get various pieces of tree
    // childNodes contains arc labels followed by subtrees
    var textNode = a_container.children("text.node-label");
    var childNodes = a_container.filter('[expanded="yes"]').
                                 children("g.tree-node");
    var numChildren = childNodes.size();
    var childNodeArray = childNodes.get();
    childNodeArray.sort(compareByIdDir);

    // set expansion status of children
    // calculate size of tree
    var textHeight = (5 * a_fontSize) / 4;
    var childSeparation = a_fontSize;
    var textWidth = textNode[0].getComputedTextLength();
    textWidth += (textWidth > 0) ? a_fontSize : 0;
    var childStart = Array();
    var childCenter = Array();
    var childReturn = Array();
    var size = Array(0, 0);
    $(childNodeArray).each(
    function()
    {
        var thisNode = $(this);

        // get size, center, and root width of child
        var thisReturn = positionTree(thisNode, a_fontSize);
        var thisSize = thisReturn[0];
        childReturn.push(thisReturn);

        // adjust center for offset, save start of child
        childCenter.push(size[0] + thisReturn[1]);
        childStart.push(size[0]);

        // adjust total width and max height
        size[0] += thisSize[0] + childSeparation;
        if (thisSize[1] > size[1])
            size[1] = thisSize[1];
    });
    // remove separation at right end
    if (size[0] > 0)
        size[0] -= childSeparation;

    // tighten up spacing of subtrees with root only
    var adjust = 0;
    var treeEdge = 0;
    size[0] = 0;
    for (var i = 0; i < numChildren; ++i)
    {
        // adjust positions
        childStart[i] -= adjust;
        childCenter[i] -= adjust;

        // if this subtree has root node only
        // it's a candidate to tighten up
        if ($(childNodeArray[i]).children("g.tree-node").size() == 0)
        {
            // can we move closer to preceding subtree?
            if ((i > 0) &&
                ($(childNodeArray[i - 1]).children("g.tree-node").size() > 0))
            {
                // difference between right edge of preceding subtree and
                // right edge of preceding root
                var newAdjust =
                    (childStart[i - 1] + childReturn[i - 1][0][0]) -
                    (childCenter[i - 1] + childReturn[i - 1][2] / 2);
                if (newAdjust > 0)
                {
                    childStart[i] -= newAdjust;
                    childCenter[i] -= newAdjust;
                    adjust += newAdjust;
                }
            }
            // can we move closer to following subtree?
            if ((i + 1 < numChildren) &&
                ($(childNodeArray[i + 1]).children("g.tree-node").size() > 0))
            {
                // difference between left edge of following root and
                // left edge of following subtree
                var newAdjust = (childCenter[i+1] - childReturn[i+1][2] / 2) -
                                 childStart[i+1];
                if (newAdjust > 0)
                    adjust += newAdjust;

                // if following tree would overlap preceding
                // make sure we don't
                if (childStart[i + 1] - adjust < treeEdge)
                    adjust -= treeEdge - (childStart[i + 1] - adjust);
            }
        }

        // update total width
        var edge = childStart[i] + childReturn[i][0][0] + childSeparation;
        if (edge > size[0])
            size[0] = edge;
        if (($(childNodeArray[i]).children("g.tree-node").size() > 0) &&
            (edge > treeEdge))
        {
            treeEdge = edge;
        }
    }

    // position subtrees, arcs, and arc labels
    // center pt is midway between midpoints of first and last child
    // xExcess is amount needed to center if this label is wider than children
    var xCenter = 0;
    if (childCenter.length > 0)
        xCenter = (childCenter[0] + childCenter[childCenter.length - 1]) / 2;
    var xExcess = ((textWidth > size[0]) ? (textWidth - size[0]) : 0) / 2;
    xCenter += xExcess;
    var y1 = s_showExpansionControls ? (3 * textHeight / 2) : textHeight;
    var y2 = y1 + a_fontSize * 3;
    size[0] += 2 * xExcess;
    size[1] += y2;
    for (var i = 0; i < numChildren; ++i)
    {
        var nodeGroup = $(childNodeArray[i]);
        var tx = xExcess + childStart[i];
        var ty = y2;
        childNodeArray[i].
            setAttribute("transform", "translate(" + tx + "," + ty + ")");
        var arc = nodeGroup.children("line")[0];
        var x2 = xExcess + childCenter[i];
        arc.setAttribute("x1", xCenter - tx);
        arc.setAttribute("y1", y1 - ty);
        arc.setAttribute("x2", x2 - tx);
        arc.setAttribute("y2", y2 - ty);
        var label = nodeGroup.children("text.arc-label")[0];
        var width = label.getComputedTextLength();
        var xl = (2 * x2 + xCenter)/3;
        if (x2 <= xCenter)
        {
            xl -= (x2 == xCenter) ? 2 : 1;
            label.setAttribute("text-anchor", "end");
        }
        else
        {
            xl += 1;
            label.setAttribute("text-anchor", "start");
            if (xl + width > size[0])
                size[0] = xl + width;
        }
        var yl = (y1 + 2 * y2) / 3;
        label.setAttribute("x", xl - tx);
        label.setAttribute("y", yl - ty);
        var labelRect = nodeGroup.children("rect.arc-highlight")[0];
        var arcLabelHeight = 11;
        labelRect.setAttribute("width", width);
        labelRect.setAttribute("height", arcLabelHeight);
        labelRect.setAttribute("x",
                               (xl - tx) - ((x2 <= xCenter) ? width : 0));
        labelRect.setAttribute("y", yl - ty - arcLabelHeight);

        // set up help text for arc label
        var dyl = 3 * a_fontSize / 4;
        nodeGroup.children("text.arc-label-help-up").each(
        function()
        {
            this.setAttribute("text-anchor", "start");
            this.setAttribute("x", ((x2 <= xCenter) ? xl - width : xl) - tx);
            this.setAttribute("y", (yl - dyl) - ty);
        });
        nodeGroup.children("text.arc-label-help-dn").each(
        function()
        {
            this.setAttribute("text-anchor", "start");
            this.setAttribute("x", ((x2 <= xCenter) ? xl - width : xl) - tx);
            this.setAttribute("y", (yl + dyl) - ty);
        });
    }

    // position text and rectangles
    textNode.each(
    function()
    {
        this.setAttribute("y", a_fontSize);
        this.setAttribute("x", xCenter);
    });
    a_container.children("rect.highlight").each(
    function()
    {
        this.setAttribute("x", xCenter - textWidth / 2);
        this.setAttribute("y", 0);
        this.setAttribute("width", textWidth);
        this.setAttribute("height", textHeight);
    });
    if (s_showExpansionControls)
    {
        a_container.children("g.expand").each(
        function()
        {
            this.setAttribute("transform",
                              "translate(" + (xCenter - textHeight / 4) +
                              ", " + textHeight + ")");
            var rect = $("rect", this)[0];
            rect.setAttribute("x", 0);
            rect.setAttribute("y", 0);
            rect.setAttribute("width", textHeight / 2);
            rect.setAttribute("height", textHeight / 2);
            var text = $("text", this)[0];
            text.setAttribute("x", textHeight / 4);
            text.setAttribute("y", textHeight / 2);
            $(text).text((a_container.attr("expanded") == "yes") ?
                            s_contractionSymbol :
                            s_expansionSymbol);

            // if no children, hide expansion controls
            if (a_container.children("g.tree-node").size() == 0)
                this.setAttribute("visibility", "hidden");
            else
                this.removeAttribute("visibility");
        });
    }

    return Array(size, xCenter, textWidth);
};

/**
 * Comparison functions for id values
 *
 * compareById - sort ascending
 * compareByIdDir - sort ascending if LTR text, descending if RTL
 * compareByIdBase - do actual comparison
 * @param {Element} a_a first element to compare
 * @param {Element} a_b second element to compare
 * @param {int} a_mult multiplier (1=increasing, -1=decreasing)
 * @return <0, =0, >0 as a < b, a = b, a > b, respectively
 * @type Number
 */
function compareByIdBase(a_a, a_b, a_mult)
{
    var id1 = $(a_a).attr("id").split('-');
    var id2 = $(a_b).attr("id").split('-');
    for (var i = 0; i < Math.min(id1.length, id2.length); ++i)
    {
        var diff = Number(id1[i]) - Number(id2[i]);
        if (diff != 0)
            return a_mult * diff;
    }

    // if all initial components match, shortest comes first
    return a_mult * (id2.length - id1.length);
};

function compareById(a_a, a_b)
{
    return compareByIdBase(a_a, a_b, 1);
};

function compareByIdDir(a_a, a_b)
{
    return compareByIdBase(a_a, a_b, (s_direction == "rtl") ? -1 : 1);
};

/**
 * Position text words:
 *
 * The text words are placed underneath the tree itself, wrapping
 * at the width of the tree (except if the tree is narrow, wrapping
 * at 300 pixels).
 
 * The height and width including the text are set as the values for
 * the parent svg element.
 *
 * @param {Document} a_doc the document
 * @param {int} a_width width of tree
 * @param {int} a_fontSize size of font in pixels
 * @return size (width, height) of text
 * @type Array
 */
function positionText(a_doc, a_width, a_fontSize)
{
    // if no words, just return empty size
    var words = $("#dependency-tree", a_doc).children("g").next().children("text");
    var rects = $("#dependency-tree", a_doc).children("g").next().children("rect");
    if (words.size() == 0)
        return Array(0, 0);

    // 300 = minimum width allowed for text to avoid excessive wrapping
    var width = (a_width > 300) ? a_width : 300;
    var textHeight = (5 * a_fontSize) / 4;
    var x = 0;
    var y = textHeight;

    // for each word
    for (var i = 0; i < words.size(); ++i)
    {
        var word = words[i];
        var rect = rects[i];

        // if word goes past end of line
        var wlen = word.getComputedTextLength();
        if (x + wlen > width)
        {
            // if not first word in line, wrap
            if (x > 0)
            {
                x = 0;
                y += textHeight;
            }
            // if first word, widen line
            else
            {
                width = wlen;
            }
        }

        // position word and bounding rectangle
        var xx = (s_direction == "rtl") ? (width - x - wlen) : x;
        word.setAttribute("x", xx);
        word.setAttribute("y", y);
        rect.setAttribute("x", xx);
        rect.setAttribute("y", (y - a_fontSize));
        rect.setAttribute("width", wlen);
        rect.setAttribute("height", textHeight);

        // advance in line
        x += wlen;
    }

    return Array(width, y + textHeight - a_fontSize);
};

/**
 * Position pieces
 * @param {Document} a_doc the document
 * @param {Array} a_treeSize width and height of tree
 * @param {Array} a_textSize width and height of text
 * @param {int} a_fontSize size of font in pixels
 */
function positionAll(a_doc, a_treeSize, a_textSize, a_fontSize)
{
    // position text at top 
    $("#dependency-tree g.text", a_doc)[0].
        setAttribute("transform", "translate(0)");
    // position tree below text
    $("#dependency-tree g.tree", a_doc)[0].
        setAttribute("transform",
                     "translate(" + a_fontSize + "," + a_textSize[1] + ")");

    // set width and height
    // use double size to ensure subtrees are visible while moving
    var width = a_textSize[0];
    if (a_fontSize + a_treeSize[0] > width)
        width = a_fontSize + a_treeSize[0];
    var height = a_textSize[1] + a_treeSize[1];
    $("#dependency-tree", a_doc)[0].setAttribute("width", 1.1 * width);
    $("#dependency-tree", a_doc)[0].setAttribute("height", 1.1 * height);
};

/**
 * Highlight a word in the tree:
 *
 *  The word and its surrounding lines and nodes
 *  are left with normal coloring.  The remainder
 *  of the tree is grayed out.
 *
 *  If no id or a bad id is specified, the entire tree is
 *  ungrayed.
 *
 * @param {Document} a_doc the document
 * @param {String} a_id id of word in tree
 */
function highlightWord(a_doc, a_id)
{
    // find node of interest
    var focusNode = $("#" + a_id, a_doc);

    // if no id or bad id
    if (focusNode.size() == 0)
    {
        $("#dependency-tree", a_doc).children("g").each(
        function()
        {
            var thisNode = $(this);
            if (thisNode.attr("class") != "key")
            {
                // display everything normally
                thisNode.find("text").each(
                function()
                {
                    this.setAttribute("showme", "normal");
                });
                thisNode.find("line").each(
                function()
                {
                    this.setAttribute("showme", "normal");
                });
                thisNode.find("rect").each(
                function()
                {
                    this.setAttribute("showme", "normal");
                });
            }
        });
        return;
    }

    // gray everything out in tree
    $("#dependency-tree g.tree text", a_doc).attr("showme", "grayed");
    $("#dependency-tree g:not(.key) line", a_doc).attr("showme", "grayed");
    $("#dependency-tree g:not(.key) rect", a_doc).attr("showme", "grayed");

    // display this node and things connected to it with focus:
    //   text node itself and label on line to dependent words
    //   rectangle around node
    //   lines to dependent words
    focusNode.children("g").
              children("text.arc-label").
              attr("showme", "focus-child");
    focusNode.children("text.node-label").attr("showme", "focus");
    focusNode.children("rect").attr("showme", "focus");
    focusNode.children("g").children("line").attr("showme", "focus-child");

    //   dependent words (immediate children)
    var children = focusNode.children("g");
    children.children("rect").attr("showme", "focus-child");
    children.children("text.node-label").attr("showme", "focus-child");

    //   descendant words at all levels
    //   line to descendant words
    var descendants = focusNode.find("g g");
    descendants.find("rect,line,text").attr("showme", "focus-descendant");

    //   label on parent word
    //   line and label from parent word
    var parent = focusNode.parent(".tree-node");
    parent.children("text.node-label").attr("showme", "focus-parent");
    parent.children("rect").attr("showme", "focus-parent");
    focusNode.children("line").attr("showme", "focus-parent");
    focusNode.children("text.arc-label").attr("showme", "focus-parent");

    // set highlights on text words
    highlightTextWord(a_doc, a_id, "focus");
    highlightTextWord(a_doc, focusNode.parent().attr("id"), "focus-parent");
    descendants.each(
    function()
    {
        highlightTextWord(a_doc, this.getAttribute("id"), "focus-descendant");
    });
    children.each(
    function()
    {
        highlightTextWord(a_doc, this.getAttribute("id"), "focus-child");
    });
};

/**
 * Highlight a text word
 * @param {Document} a_doc the document
 * @param {String} a_id id of word (tbref attribute on text word)
 * @param {String} a_focus value to set showme attribute to
 */
function highlightTextWord(a_doc, a_id, a_focus)
{
    // do nothing if no id specified
    if ((a_id == null) || (a_id.length == 0))
        return;

    $("rect", a_doc).each(
    function()
    {
        if (this.getAttribute("tbref") == a_id)
        {
            this.setAttribute("showme", a_focus);
        }
    });
};

/**
 * Highlight initial word in the tree
 * @param {Document} a_doc the document
 * @param {Array} a_ids ids of words in tree
 */
function highlightFirst(a_doc, a_ids)
{
    // for each id
    for (i in a_ids)
    {
        var id = a_ids[i];

        // find node of interest
        var focusNode = $("#" + id, a_doc);

        // if no id or bad id
        if (focusNode.size() == 0)
            return;

        // set attribute in tree
        focusNode.children("text.node-label").each(
            function() { this.setAttribute("first", "yes"); });
        focusNode.children("rect").each(
            function() { this.setAttribute("first", "yes"); });

        // set attribute in text
        $("rect", a_doc).each(
        function()
        {
            if (this.getAttribute("tbref") == id)
                this.setAttribute("first", "yes");
        });
    }
};

/**
 * Traverse nodes in tree
 *
 *  left/right - move through siblings, wrapping if needed
 *  up - move to parent
 *  down - move to left-right child, dependending in text direction
 */
function traverseTreeLeft()
{
    var current = $("#" + s_currentId, document);
    var neighbor = (s_direction == "rtl") ? current.next("g.tree-node") :
                                            current.prev("g.tree-node");
    if (neighbor.size() == 0)
    {
        neighbor = current.siblings("g.tree-node");
        neighbor =
            neighbor.eq((s_direction == "rtl") ? 0 : (neighbor.size() - 1));
    }

    if (neighbor.size() > 0)
    {
        s_currentId = neighbor.attr("id");
        highlightWord(document, s_currentId);
    }
};

function traverseTreeRight()
{
    var current = $("#" + s_currentId, document);
    var neighbor = (s_direction == "rtl") ? current.prev("g.tree-node") :
                                            current.next("g.tree-node");
    if (neighbor.size() == 0)
    {
        neighbor = current.siblings("g.tree-node");
        neighbor =
            neighbor.eq((s_direction == "rtl") ? (neighbor.size() - 1) : 0);
    }

    if (neighbor.size() > 0)
    {
        s_currentId = neighbor.attr("id");
        highlightWord(document, s_currentId);
    }
};

function traverseTreeUp()
{
    var current = $("#" + s_currentId, document);
    var neighbor = current.parent("g.tree-node");
    if (neighbor.size() > 0)
    {
        s_currentId = neighbor.attr("id");
        highlightWord(document, s_currentId);
    }
};

function traverseTreeDown()
{
    var current = $("#" + s_currentId, document);
    var neighbor = current.children("g.tree-node:first");
    if (neighbor.size() > 0)
    {
        s_currentId = neighbor.attr("id");
        highlightWord(document, s_currentId);
    }
};