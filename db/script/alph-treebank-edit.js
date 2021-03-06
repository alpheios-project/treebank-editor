/**
 * @fileoverview alph-treebank-edit - treebank editor
 *  
 * Copyright 2009-2010 Cantus Foundation
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
var s_param = [];                     // parameters and metadata

var s_tbDesc = null;                  // treebank description

var s_showExpansionControls = true;
var s_contractionSymbol = "-";
var s_expansionSymbol = "+";

var s_currentId = null;               // current target id
var s_currentLabelId = null;          // id of current label
var s_currentLabelType = null;        // type of current label
var s_dragId = null;                  // dragged word id
var s_dragObj = null;                 // object being dragged
var s_dragStartTrans = null;          // initial transform of group
var s_dragTransX = 0;                 // X translation of group
var s_dragTransY = 0;                 // Y translation of group
var s_dragX = 0;                      // mouse X
var s_dragY = 0;                      // mouse Y

var s_posIndex = 0;                   // index of part of speech in morphology
var s_minWidth = 300;                 // minimum text width
var s_expandFactor = 1.1;             // how much to expand window for dragging

var s_firefox = false;                // in Firefox
var s_mode = "tree";                  // edit mode: view/tree/label/ellipsis

// table of [active?, key, char, modifiers, function, arg, keyname, help]
// where modifiers is four-char string acsm, where
//    a = 1 if altKey else 0
//    c = 1 if ctrlKey else 0
//    s = 1 if shiftKey else 0
//    m = 1 if metaKey else 0
//
var s_keyTable =
[
    ["left",     false,   0, 104, "0000", traverseTreeLeft,  null,       "h",             "Left"],
    ["right",    false,   0, 108, "0000", traverseTreeRight, null,       "l",             "Right"],
    ["down",     false,   0, 106, "0000", traverseTreeDown,  null,       "j",             "Down"],
    ["up",       false,   0, 107, "0000", traverseTreeUp,    null,       "k",             "Up"],
    ["tree",     true,  112,   0, "0100", SetMode,           "tree",     "Ctrl+F1",       "Tree tool"],
    ["label",    true,  113,   0, "0100", SetMode,           "label",    "Ctrl+F2",       "Label tool"],
    ["ellipsis", true,  114,   0, "0100", SetMode,           "ellipsis", "Ctrl+F3",       "Ellipsis tool"],
    ["finish",   true,   13,   0, "0000", FinishAction,      null,       "&lt;Enter&gt;", "Finish action"],
    ["abort",    true,   27,   0, "0000", AbortAction,       null,       "&lt;Esc&gt;",   "Abort action"],
    ["redo",     true,    0, 121, "0100", ClickOnRedo,       null,       "Ctrl+Y",        "Redo"],
    ["undo",     true,    0, 122, "0100", ClickOnUndo,       null,       "Ctrl+Z",        "Undo"],
    ["save",     true,    0, 115, "0100", SaveContents,      null,       "Ctrl+S",        "Save contents"],
    ["nextword", true,    0,  43, "0010", ShowNextWord,      null,       "+",             "Show next word"],
    ["history",  true,    0, 118, "0100", ShowHistory,       null,       "Ctrl+V",        "History"]
];
// symbolic names for key table fields
var s_ktName = 0;
var s_ktActive = 1;
var s_ktKey = 2;
var s_ktChar = 3;
var s_ktMod = 4;
var s_ktFunc = 5;
var s_ktArg = 6;
var s_ktKeyname = 7;
var s_ktHelp = 8;

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
        $("body", document).hide();

        // initialize internal params
        s_param["firebug"] = "no";
        s_param["app"] = "editor";

        // get parameters from html metadata of form
        //  <meta name="alpheios-param-<name>" content="<value>"/>
        var prefix = "alpheios-param-";
        $("meta[name^='" + prefix + "']", document).each(
        function ()
        {
            var name = $(this).attr("name").substr(prefix.length);
            s_param[name] = $(this).attr("content");
        });

        // get parameters from call
        // Note: processed after parameters in metadata, so that
        // call parameters can override
        var callParams = location.search.substr(1).split("&");
        var numParams = callParams.length;
        for (i in callParams)
        {
            s_param[i] = callParams[i].split("=");
            s_param[s_param[i][0]] = s_param[i][1];
        }
        s_param["numParams"] = numParams;

        // make key table accessible by name
        for (i in s_keyTable)
            s_keyTable[s_keyTable[i][s_ktName]] = Number(i);

        // set state variables
        if (navigator.userAgent.indexOf("Firefox") != -1)
            s_firefox = true;
        var form = $("form[name='sent-edit-mode']", document); 
        if (form.size() > 0)
            s_mode = $("input[checked]", form).attr("value");
        $("body", document).attr("alpheios-mode", s_mode);
        
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
            req = new XMLHttpRequest();
            // build list of content to be built
            var toBuild = s_param["buildContent"];
            toBuild = (toBuild && toBuild.length) ? toBuild.split(',') : [];
            for (i in toBuild)
                toBuild[toBuild[i]] = toBuild[i];
           
            // get info on format
            var builtUrl = getInfoURL.replace(/DOC_REPLACE/,s_param["doc"]);
            builtUrl = builtUrl.replace(/APP_REPLACE/,s_param["app"]);
            builtUrl = builtUrl.replace(/DESC_REPLACE/,(((toBuild.length > 0) ||
                          (s_param["app"] == "viewer")) ? "y" : ""));
            req.open("GET", builtUrl, false);
            req.send(null);
             if (req.status != 200)
            {
                var msg = "Can't get Format Info ";
                alert(msg);
                throw(msg);
            }
            var root = $(req.responseXML.documentElement);
            if ($("desc", root).size() > 0) {
                s_tbDesc = $("desc", root).get(0);
            }
            if (root.is("error"))
            {
                var msg = root.is("error") ?
                            root.text() :
                            "Error getting info for treebank " + s_param["doc"];
                alert(msg);
                throw(msg);
            }
            if ((toBuild["menus"] || toBuild["style"] || toBuild["key"]) && s_tbDesc == null) {
                var msg = "Unable to build menus for requested format";
                alert(msg);
                throw(msg);   
            }

            // save treebank attributes
            s_param["numSentences"] = Number(root.attr("numSentences"));
            s_param["lang"] = root.attr("xml:lang");
            s_param["direction"] = root.attr("direction");

            // save treebank metadata
            $("meta", root).each(
            function ()
            {
                s_param[$(this).attr("name")] = $(this).attr("value");
            });

            // build various content
            if (toBuild["menus"])
            {
                s_editTransform.setParameter(null, "e_mode", "menus");
                s_editTransform.setParameter(null, "e_app", s_param["app"]);
                var menus =
                        s_editTransform.transformToDocument(req.responseXML);
                var menuContent = $(menus.documentElement).children();
                $("div#label-menus", document).append(menuContent);
            }
            if (toBuild["style"])
            {
                s_editTransform.setParameter(null, "e_mode", "style");
                s_editTransform.setParameter(null, "e_app", s_param["app"]);
                var style =
                        s_editTransform.transformToDocument(req.responseXML);
                var styleRules = $(style).text().split('\n');
                for (i in styleRules)
                    if (styleRules[i] != null && styleRules[i] != "") {
                        document.styleSheets[0].insertRule(styleRules[i], 0);
                    }
            }
            if (toBuild["key"])
            {
                s_editTransform.setParameter(null, "e_mode", "key");
                s_editTransform.setParameter(null, "e_app", s_param["app"]);
                var key = s_editTransform.transformToDocument(req.responseXML);
                var keyContent = $(key.documentElement);
                $("div#key", document).append(keyContent);
            }
        }

        // adjust html structure
        if (s_param["app"] == "viewer")
        {
            $("#edit-controls", document).hide();
            $("#alph-page-header", document).hide();
            $("body", document).attr("alpheios-mode", "view");
        }
        if (!s_param["sentenceNavigation"] ||
            (s_param["sentenceNavigation"] == "no"))
        {
            $("div#sent-navigation", document).hide();
        }
        var arcEditing =  s_param["arcEditing"] &&
                         (s_param["arcEditing"] == "yes");
        if (!arcEditing)
            $("#arc-label-menus", document).hide();
        var nodeEditing =  s_param["nodeEditing"] &&
                          (s_param["nodeEditing"] == "yes");
        if (!nodeEditing)
            $("#node-label-menus", document).hide();
        if (!arcEditing && !nodeEditing)
        {
            $("#label-button", document).hide();
            s_keyTable[s_keyTable["label"]][s_ktActive] = false;
        }
        if (!s_param["ellipsis"] || (s_param["ellipsis"] == "no"))
        {
            $("#ellipsis-button", document).hide();
            s_keyTable[s_keyTable["ellipsis"]][s_ktActive] = false;
        }
        if (!s_param["sequential"] || (s_param["sequential"] == "no"))
        {
            $("#nextword-button", document).hide();
            s_keyTable[s_keyTable["nextword"]][s_ktActive] = false;
        }

        // add shortcuts to key display
        var shortcuts = $("#key_shortcuts", document);
        if (shortcuts.size() > 0)
        {
            for (i in s_keyTable)
            {
                // skip inactive keys
                if (!s_keyTable[i][s_ktActive])
                    continue;

                shortcuts.append(
                    "<tr>" +
                      "<td>" + s_keyTable[i][s_ktKeyname] + "</td>" +
                      "<td>" + s_keyTable[i][s_ktHelp] + "</td>" +
                    "</tr>");
            }
        }

        // add shortcuts to hover text for buttons
        var buttonList =
        [
          "tree", "label", "ellipsis", "undo", "redo", "save", "nextword"
        ];
        for (i in buttonList)
        {
            // if shortcut key is active
            var key = s_keyTable[s_keyTable[buttonList[i]]];
            if (key[s_ktActive])
            {
                // add its name to button title
                var button = $("#" + buttonList[i] + "-button", document);
                var title = button.attr("title");
                button.attr("title", title + " [" + key[s_ktKeyname] + "]");
            }
        }

        // some miscellaneous values
        s_posIndex =
            Number($("select[name='node-label-pos']", document).attr("n")) - 1;
        s_minWidth = (s_param["app"] == "viewer") ? 300 : (screen.width * .75);
        s_expandFactor = (s_param["app"] == "viewer") ? 1.0 : 1.1;
        if (s_param["app"] == "viewer")
            s_mode = "view";

        // add event handlers
        $("#node-label-menus select", document).change(FormChanged);

        // set various values in html
        var exitForm = $("form[name='sent-navigation-exit']", document);
        var exitURL = $("meta[name='alpheios-exitURL']", document);
        var exitAction = exitURL.attr("content").replace(/DOC_REPLACE/,s_param["doc"]);
        var exitLabel = $("meta[name='alpheios-exitLabel']", document);
        exitForm.attr("action", exitAction);
        $("input[name='doc']", exitForm).attr("value", s_param["doc"]);
        $("button", exitForm).text(exitLabel.attr("content"));
        $("html", document).attr("xml:lang", s_param["lang"]);
        $("svg", document).attr("alph-doc", s_param["doc"]);

        // get URLs from header
        s_getSentenceURL =
          $("meta[name='alpheios-getSentenceURL']", document).attr("content");
        s_putSentenceURL =
          $("meta[name='alpheios-putSentenceURL']", document).attr("content");

        // go to new sentence
        InitNewSentence();

        $("body", document).show();

        var evt = document.createEvent("Events");
        evt.initEvent("AlpheiosTreeLoaded", false, true);
        document.dispatchEvent(evt);

    }
    catch(e)
    {
        alert("Unable to load treebank data: " + e);
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

    // clear past notifications
    AlphEdit.clearNotifications();

    // get and transform treebank sentence
    var sentence;
    var localSentence = $('#sentence-xml').html();
    var sentParam = (s_param["s"] ? "s" : "id");
    if (localSentence) {
        sentence = localSentence
        $("#sent-navigation").hide();
        $("form[name=sent-navigation-exit]").remove();
        $("#save-button").hide();
    }   
    else if (s_getSentenceURL != null) {
        if (AlphEdit.getContents.length > 2)
        {
            // expecting more than two args: it's old version
            sentence = AlphEdit.getContents(s_getSentenceURL,
                                            s_param["doc"],
                                            s_param[sentParam]);
    
        }
        else
        {
            // expecting two args: it's new version
            var params = [];
            params["doc"] = s_param["doc"];
            params["app"] = s_param["app"];
            params[sentParam] = s_param[sentParam];
            sentence = AlphEdit.getContents(s_getSentenceURL, params);
        }
    }
    if (sentence ==  null) {
        return;
    }
    if (typeof sentence =="string")
    {
        sentence = (new DOMParser()).parseFromString(sentence,"text/xml");
    }
    var root = $(sentence.documentElement);
    s_param["document_id"] = root.attr("document_id");
    s_param["subdoc"] = root.attr("subdoc");
    
    // add the document info to the display
    $(".alpheios-document-id").html(s_param["document_id"]);
    $(".alpheios-subdoc").html(s_param["subdoc"]);
    var sentId = root.attr("id");
    s_editTransform.setParameter(null, "e_mode", "xml-to-svg");
    s_editTransform.setParameter(null, "e_app", s_param["app"]);
    // TODO THIS DOES NOT WORK IN WEBKIT BROWSERS - THEY DO NOT SEEM
    // TO SUPPORT PASSING A NODE AS A PARAMETER TO XSLT PROCESSOR
    // TRY USING SAXON-CE??
    if (s_tbDesc) 
        s_editTransform.setParameter(null, "e_desc", s_tbDesc);
    var svg = s_editTransform.transformToDocument(sentence);
    $("svg", document).empty().append($(svg.documentElement).children());

    // sentence id in <svg>
    $("svg", document).attr("alph-" + sentParam, s_param[sentParam]);

    // fix numeric sentence number
    s_param["snum"] = Number(s_param["s"]);
    if (isNaN(s_param["snum"]))
        s_param["snum"] = 1;
    else if (s_param["snum"] <= 0)
        s_param["snum"] = 1;
    if (s_param["snum"] > s_param["numSentences"])
        s_param["snum"] = s_param["numSentences"];

    var s = s_param["snum"];
    var numSentences = s_param["numSentences"];

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
    if (s >= numSentences)
        button.attr("disabled", "disabled");
    else
        button.removeAttr("disabled");
    if (s >= numSentences)
        button.text("\u25B8\u00A0" + numSentences);
    else
        button.text("\u25B8\u00A0" + (s + 1));

    // last sentence button
    button = $("#last-button", document);
    button.attr("value", numSentences);
    if (s >= numSentences)
        button.attr("disabled", "disabled");
    else
        button.removeAttr("disabled");
    button.text("\u25B8\u25B8\u00A0" + numSentences);

    // html fixes
    var title_text = s_param["app"] == 'viewer' ? 'View Treebank Sentence' : 'Edit Treebank Sentence';
    $("head title", document).text("Alpheios:" + title_text + ':' +
                                   s_param["document_id"] +
                                   ": " +
                                   s_param["subdoc"]);
    // only display the alpheios trigger hint in viewer mode
    if (s_param['app'] == 'viewer')
    {
        $(".alpheios-trigger-hint",document).css("display","block");
    }
    $("form[name='sent-navigation-exit'] input[name='s']",
      document).attr("value", s_param["s"]);

    // set initial state of controls
    $("form[name='sent-navigation-goto'] input", document).removeAttr("value");
    $("#expansion-checkbox", document).attr("checked", "checked");
    s_showExpansionControls = true;

    // this seems to be fixed in Firefox 7. Leaving code in place commented out for now
    // right-to-left doesn't seem to be working in firefox svg
    // reverse strings by hand
    //if (s_firefox && (s_param["direction"] == "rtl"))
    //{
    //    AlphEdit.reverseText($("text.node-label", document), "form");
    //   AlphEdit.reverseText($("text.text-word", document), null);
    //}

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

    // add hover text
    var nodeForm = $("#node-label-menus", document);
    $("g.tree-node[lemma], g.tree-node[postag]", document).each(
    function()
    {
        SetHoverText($(this), nodeForm);
    });

    // initialize handlers
    InitHandlers(document, false);

    // for text group, turn off highlighting when we leave
    $("g.text", document).bind(
        "mouseleave",
        function() { highlightWord(this.ownerDocument, null); }
    );

    // bind mouse events
    $("body", document).bind("click", Click);
    $("body", document).bind("mousemove", Drag);

    // set/reset buttons
    $("#undo-button", document).attr("disabled", "disabled");
    $("#redo-button", document).attr("disabled", "disabled");
    $("#save-button", document).attr("disabled", "disabled");
    AdjustButtons();

    // highlight initial words in viewer
    if ((s_param["app"] == "viewer") && s_param["w"] && s_param["w"].length)
    {
        var wds = s_param["w"].split(',');
        for (i in wds)
            wds[i] = sentId + '-' + wds[i];
        highlightFirst(document, wds);
    }

    // adjust for sequential display
    if (s_param["sequential"] && (s_param["sequential"] != "no"))
    {
        $("g.text *", document).attr("display", "none");
        $("g.tree-node", document).attr("display", "none");
        $("g.tree > g", document).attr("display", "inline");
        if ($("text.text-word", document).size() == 0)
        {
            $("#nextword-button", document).attr("disabled", "disabled");
            var button = $("#nextword-button", document);
            $("img", button).attr("src", button.attr("base") + "-disabled.png");
        }
        else
        {
            $("#nextword-button", document).removeAttr("disabled");
            ShowNextWord();
        }
    }

    Reposition();
};

/**
 * Initialize handlers for node or nodes
 * @param {Node} a_node root node
 * @param {Boolean} a_single whether to do single node
 */
function InitHandlers(a_node, a_single)
{
    var prefix = a_single ? "> ": "";

    // for each text word, turn on highlighting for the word
    $(prefix + "text.text-word", a_node).bind(
        "mouseenter",
        function()
        {
            var tbrefid = $(this).attr("tbref");
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

    // for each label, highlight the word while hovering
    $(prefix + "text.node-label, " + prefix + "rect.highlight", a_node).hover(
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
            highlightWord(this.ownerDocument, $(this).parent().attr("id"));
        },
        function() { highlightWord(this.ownerDocument, null); }
    );

    // for each arc highlight, highlight while hovering
    $(prefix + "text.arc-label, " + prefix + "rect.arc-highlight",
      a_node).hover(
        function()
        {
            if (s_mode == "label")
            {
                var label = $(this).parent().children("rect.arc-highlight");
                AlphEdit.addClass(label[0], "hovering");
            }
        },
        function()
        {
            var label = $(this).parent().children("rect.arc-highlight");
            AlphEdit.removeClass(label[0], "hovering");
        }
    );

    // for each expansion control, highlight while hovering
    $(prefix + "g.expand", a_node).hover(
        function()
        {
            if (!s_dragObj)
                $(this).attr("showme", "focus");
        },
        function() { $(this).attr("showme", "normal"); }
    );

    // bind mouse events
    $(prefix + "text.text-word, " + prefix + "text.node-label", a_node)
        .bind("mouseover", Enter)
        .bind("mouseout", Leave);
    $(prefix + "text.arc-label", a_node).bind("click", ClickOnArcLabel);
    $(prefix + "text.node-label", a_node).bind("click", ClickOnNodeLabel);
    $(prefix + "text.text-word", a_node).bind("click", ClickOnTextWord);
    $(prefix + "g.expand rect, " + prefix + "g.expand text", a_node)
        .attr("pointer-events", "all")
        .bind("click", Expand);
};

/**
 * Log message to console
 * @param {String} a_msg message to send
 */
function Log(a_msg)
{
    if (s_param["firebug"] == "yes")
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
    Log("Click");
    var event = AlphEdit.getEvent(a_event);

    switch (s_mode)
    {
      case "tree":
        (s_dragObj ? Drop(event) : Grab(event));
        break;

      case "ellipsis":
        ElidedNode();
    }
};

/**
 * Event handler for picking up word/subtree
 * @param {Event} a_event the event
 */
function Grab(a_event)
{
    Log("Grab");
    var event = AlphEdit.getEvent(a_event);
    var target = AlphEdit.getEventTarget(event);

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
            s_dragObj.setAttribute("transform", newTransform);
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
        MoveNode(s_dragId, s_currentId, true);
    }
    else
    {
        Log("Dragging abandoned");
    }

    // restore to original position, if any
    if (s_dragStartTrans)
        s_dragObj.setAttribute("transform", s_dragStartTrans);
    else
        s_dragObj.removeAttribute("transform");

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
    ExpandNode(node.getAttribute("id"),
               (expanded == "yes") ? "no" : "yes",
               true);

    // redraw tree
    Reposition();
};

/**
 * Event handler for undo operation
 * @param {Event} a_event the event
 * @return whether action was performed
 * @type Boolean
 */
function ClickOnUndo(a_event)
{
    ReplayEvent(AlphEdit.popHistory(AdjustButtons), false);
    return true;
};

/**
 * Event handler for redo operation
 * @param {Event} a_event the event
 * @return whether action was performed
 * @type Boolean
 */
function ClickOnRedo(a_event)
{
    ReplayEvent(AlphEdit.repushHistory(AdjustButtons), true);
    return true;
};

/**
 * Event handler for toggling display of expansion controls
 * @param {Event} a_event the event
 */
function ShowExpansionControls(a_event)
{
    s_showExpansionControls = !s_showExpansionControls;
    if (s_showExpansionControls)
        $("#expansion-checkbox", document).attr("checked", "checked");
    else
        $("#expansion-checkbox", document).removeAttr("checked");
    $("g.tree-node", document).attr("expanded", "yes");
    $("g.expand", document).
        attr("display", s_showExpansionControls ? "inline" : "none");
    Reposition();
};

/**
 * Event handler for change of label menu
 * @param {Event} a_event the event
 */
function FormChanged(a_event)
{
    Log("Form changed");
    var target = $(AlphEdit.getEventTarget(a_event));
    var option = target.is("option") ? target : $("option:selected", target);
    SetFormDisplay(target.parents("form"), option.attr("mask"));
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

    StartLabelling("arc", label, event.clientX, event.clientY);
};

/**
 * Event handler for clicking on node label
 * @param {Event} a_event the event
 */
function ClickOnNodeLabel(a_event)
{
    Log("ClickOnNodeLabel");
    var event = AlphEdit.getEvent(a_event);
    event.stopPropagation();

    switch (s_mode)
    {
      case "tree":
        (s_dragObj ? Drop(event) : Grab(event));
        break;

      case "label":
        var target = AlphEdit.getEventTarget(event);
        var label = $(target.parentNode);

        StartLabelling("node", label, event.clientX, event.clientY);
        break;

      case "ellipsis":
        ElidedNode();
    }

    return false;
};

/**
 * Event handler for clicking on text word
 * @param {Event} a_event the event
 */
function ClickOnTextWord(a_event)
{
    Log("ClickOnTextWord");
    var event = AlphEdit.getEvent(a_event);

    if (s_mode == "label")
    {
        event.stopPropagation();
        var target = AlphEdit.getEventTarget(event);
        var label = $("#" + $(target).attr("tbref"), document);
        StartLabelling("node", label, event.clientX, event.clientY);

        return false;
    }

    return true;
};

/**
 * Event handler for label menu
 * @param {Event} a_event the event
 */
function ClickOnLabelButton(a_event)
{
    var target = AlphEdit.getEventTarget(a_event);

    switch (s_currentLabelType)
    {
      case "arc":
        // hide menu
        var div = $("#arc-label-menus", document);
        div.hide();

        if ($(target).attr("id") == "arc-label-ok")
        {
            var newLabel = "";
            var label = $('select[name="arc-label-1"]', div);
            if (label.size() > 0)
                newLabel += label[0].value;
            label = $('select[name="arc-label-2"]', div);
            if (label.size() > 0)
                newLabel += label[0].value;
            LabelArc(s_currentLabelId, newLabel, true);
            Reposition();
        }

        s_currentLabelId = null;
        s_currentLabelType = null;
        break;

      case "node":
        var action = $(target).attr("id");
        var div = $("#node-label-menus", document);
        var label = $("#" + s_currentLabelId, document);

        if (action != "node-label-reset")
        {
            // hide menu
            div.hide();
        }

        switch (action)
        {
          case "node-label-reset":
            SetFormFromLabel(label, div);
            SetFormDisplay($("form", div), null);
            break;

          case "node-label-ok":
            SetLabelFromForm(label, div);
            break;
        }

        if (action != "node-label-reset")
        {
            s_currentLabelId = null;
            s_currentLabelType = null;
        }
        break;
    }
};

/**
 * Event handler for save operation
 * @param {Event} a_event the event
 */
function ClickOnSave(a_event)
{
    // no need to confirm,
    // since button should only be enabled when saving is needed
    SaveContents(null);
};

/**
 * Event handler for next word operation
 * @param {Event} a_event the event
 */
function ClickOnNextWord(a_event)
{
    ShowNextWord();
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
    // give user chance to save changes
    SaveContents("Save changes before continuing?");
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
        (Number(a_form.s.value) > s_param["numSentences"]))
    {
        alert("Sentence must between 1 and " + s_param["numSentences"]);
        return false;
    }

    // give user chance to save changes
    SaveContents("Save changes before going to new sentence?");

    // go to new sentence
    s_param["s"] = a_form.s.value;
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
    // give user chance to save changes
    SaveContents("Save changes before going to new sentence?");

    // go to new sentence
    s_param["s"] = AlphEdit.getEventTarget(a_event).value;
    InitNewSentence();
};

/**
 * Event handler for mode buttons
 * @param {Event} a_event the event
 */
function ClickOnMode(a_event)
{
    SetMode(AlphEdit.getEventTarget(a_event).value);
};

/**
 * Event handler for key presses
 * @param {Event} a_event the event
 */
function Keypress(a_event)
{
    // ignore if in viewer
    if (s_param["app"] == "viewer")
        return true;

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
        if (s_keyTable[i][s_ktActive] &&
            (s_keyTable[i][s_ktKey] == keyCode) &&
            (s_keyTable[i][s_ktChar] == charCode) &&
            (s_keyTable[i][s_ktMod] == modifiers))
        {
            if (s_keyTable[i][s_ktFunc](s_keyTable[i][s_ktArg]))
            {
                event.stopPropagation();
                event.preventDefault();
                return false;
            }
            break;
        }
    }

    return true;
};

//****************************************************************************
// actions
//****************************************************************************

/**
 * Set tool mode
 * @param {String} a_mode new mode
 * @return whether action was performed
 * @type Boolean
 */
function SetMode(a_mode)
{
    // if mode does not exist, don't try to set it
    var button = $("#" + a_mode + "-button", document);
    if (button.size() == 0)
        return false;

    // set mode
    s_mode = a_mode;
    $("body", document).attr("alpheios-mode", s_mode);

    // make sure buttons reflect mode
    $("button.mode-button", document).removeAttr("checked");
    button.attr("checked", "checked");

    return true;
};

/**
 * Move node in tree
 * @param {String} a_moveId id of element to move
 * @param {String} a_newHeadId id new head element
 * @param {Boolean} a_push whether to push event onto history
 */
function MoveNode(a_moveId, a_newHeadId, a_push)
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
                    AdjustButtons);
    }
};

/**
 * Expand/contract node in tree
 * @param {String} a_id id of element to change
 * @param {String} a_expand "yes" to expand, else contract
 * @param {Boolean} a_push whether to push event onto history
 */
function ExpandNode(a_id, a_expand, a_push)
{
    Log((a_expand == "yes") ? "Expanding " : "Contracting ", a_id);

    // set new expansion
    var node = $("#" + a_id, document);
    node.attr("expanded", a_expand);

    // push event if requested
    if (a_push)
    {
        AlphEdit.pushHistory(Array("expand", Array(a_id, a_expand)),
                             AdjustButtons);
    }
};

/**
 * Start labelling action
 * @param {String} a_type entity being labelled (arc/node)
 * @param {jQuery} a_label label node
 * @param {Number} a_x x location of mouse
 * @param {Number} a_y y location of mouse
 */
function StartLabelling(a_type, a_label, a_x, a_y)
{
    // nothing to do if menus don't exist
    var div = $("#" + a_type + "-label-menus", document);
    if (div.size() == 0)
        return;

    // nothing to do if node label of elided node
    if (a_label.is("[elided]") && (a_type == "node"))
        return;

    s_currentLabelId = a_label.attr("id");
    s_currentLabelType = a_type;

    if (a_type == "arc")
    {
        div.find("form div").text(
            "Change " + a_label.children("text.arc-label").text() + " to:");
    }
    else if (a_type == "node")
    {
        SetFormFromLabel(a_label, div);
        SetFormDisplay($("form", div), null);
    }
        
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
    div.hide();
    div.css("left", Math.max(a_x + scroll[0] - 7, 0) + "px");
    div.css("top", Math.max(a_y + scroll[1] + 7 - div.height(), 0) + "px");
    div.show();
    div.find("input, select")[0].focus();
};

/**
 * Set and select form values from label
 * @param {jQuery} a_label label node
 * @param {jQuery} a_form form
 */
function SetFormFromLabel(a_label, a_form)
{
    // clear and set lemma from label
    $("input[name='node-lemma']", a_form).attr("value", "");
    $("input[name='node-lemma']", a_form).attr("value", a_label.attr("lemma"));

    // clear all existing selections
    $("select option", a_form).removeAttr("selected");

    // for each category
    $("select", a_form).each(
    function()
    {
        // select option corresponding to current value in label postag
        var thisNode = $(this);
        var n = Number(thisNode.attr("n"));
        var val = a_label.attr("postag").substr(n - 1, 1);
        val = (val.length > 0) ? val : "-";
        thisNode.find("option[value='" + val + "']").attr("selected",
                                                          "selected");
    });
};

/**
 * Set label values from form
 * @param {jQuery} a_label label node
 * @param {jQuery} a_form form
 */
function SetLabelFromForm(a_label, a_form)
{
    // get old and new lemmas
    var oldLemma = a_label.attr("lemma");
    var newLemma = $("input[name='node-lemma']", a_form);
    newLemma = (newLemma.size() > 0) ? newLemma.attr("value") : null;
    if (!newLemma)
        newLemma = oldLemma;

    // get old morphology and break it apart
    var oldPostag = a_label.attr("postag");
    var postag = [];
    for (var i = 0; i < oldPostag.length; ++i)
        postag[i] = oldPostag[i];

    // get mask for categories
    var menu = $("option[mask]", a_form).parents("select");
    var mask = $("option:selected", menu).attr("mask");

    // get new morphology
    $("select", a_form).each(
    function()
    {
        // get index of category
        var n = Number($(this).attr("n"));

        // extend array of necessary
        if (n > postag.length)
        {
            for (var i = postag.length; i < n - 1; ++i)
                postag[i] = '-';
        }

        // if no mask or mask allows category, set from menu, else no value
        if (!mask || ((mask.length >= n) && (mask[n - 1] == "+")))
            postag[n - 1] = (this.value)[0];
        else
            postag[n - 1] = '-';
    });
    var newPostag = postag.join("");

    // if anything changed
    if ((oldLemma != newLemma) || (oldPostag != newPostag))
    {
        if (newLemma)
            a_label.attr("lemma", newLemma);
        a_label.attr("postag", newPostag);
        a_label.find("> text.node-label").attr("pos", newPostag[s_posIndex]);
        AlphEdit.pushHistory(Array("node",
                                   Array(a_label.attr("id"),
                                         oldLemma,
                                         oldPostag,
                                         newLemma,
                                         newPostag)),
                             AdjustButtons);
        SetHoverText(a_label, a_form);
    }
};

/**
 * Set label from values
 * @param {String} a_id id of label
 * @param {String} a_lemma new lemma
 * @param {String} a_postag new postag string
 */
function SetLabelFromValues(a_id, a_lemma, a_postag)
{
    var label = $("#" + a_id, document);
    if (a_lemma)
        label.attr("lemma", a_lemma);
    label.attr("postag", a_postag);
    label.find("> text.node-label").attr("pos", a_postag[s_posIndex]);
    SetHoverText(label, null);
};

/**
 * Set form displayability according to mask
 * @param {jQuery} a_form form to adjust
 * @param {String} a_mask mask of categories to display
 */
function SetFormDisplay(a_form, a_mask)
{
    // if no mask, get current value from category with masks
    if (!a_mask)
    {
        var menu = $("option[mask]", a_form).parents("select");
        a_mask = $("option:selected", menu).attr("mask");
    }

    // if mask doesn't exist, enable everything
    if (!a_mask)
    {
        $(".cmenu-row", a_form).css("display", "table-row");
        return;
    }

    // for each menu in form
    $("select", a_form).each(
    function()
    {
        var n = $(this).attr("n");
        var row = $(this).parents(".cmenu-row");

        // set visibility according to mask
        if ((a_mask.length >= n) && (a_mask[Number(n) - 1] == "+"))
            row.css("display", "table-row");
        else
            row.css("display", "none");
    });
};

/**
 * Set lemma/postag hover text
 * @param {jQuery} a_node node to set text for
 * @param {jQuery} a_form form with morphology menus
 */
function SetHoverText(a_node, a_form)
{
    var value = "";
    if (a_node.attr("lemma"))
    {
        value = a_node.attr("lemma");

        // if in viewer, strip any trailing digits from lemma
        if (s_param["app"] == "viewer")
            value = value.replace(/\d+$/, "");

        if (a_node.attr("postag"))
            value += ": ";
    }

    if (a_node.attr("postag"))
    {
        // try to get node menus, if not supplied
        if (!a_form)
            a_form = $("#node-label-menus", document);

        // if node menus available, translate categories to text
        if (a_form)
        {
            var postag = a_node.attr("postag");
            var first = true;
            for (var i = 0; i < postag.length; ++i)
            {
                if (postag[i] != '-')
                {
                    var option = $("select[n='" + (i + 1) + "'] " +
                                   "option[value='" + postag[i] + "']",
                                   a_form);
                    if (option.size() > 0)
                    {
                        if (!first)
                            value += ", ";
                        value += option.text();
                        first = false;
                    }
                }
            }
        }
        // if node menus not available, just use raw value
        else
        {
            value += a_node.attr("postag");
        }
    }

    if (value.length > 0)
    {
        var labelNode = $("> text.node-label", a_node);
        if (labelNode.size() > 0)
            labelNode[0].setAttribute("title", value);
        var textNode = $("text[tbref='" + a_node.attr("id") + "']", document);
        if (textNode.size() > 0)
            textNode[0].setAttribute("title", value);
    }
};

/**
 * Change label on arc
 * @param {String} a_id id of element to change
 * @param {String} a_label new label
 * @param {Boolean} a_push whether to push event onto history
 */
function LabelArc(a_id, a_label, a_push)
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
                                 AdjustButtons);
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
function ElidedNode()
{
    // do nothing if not over a node
    if (!s_currentId)
        return;

    if ($("#" + s_currentId, document).attr("elided"))
        DelElidedNode(true);
    else
        AddElidedNode(true);

    Reposition();
};

/**
 * Destroy elided node
 * @param {Boolean} a_push whether to push event onto history
 */
function DelElidedNode(a_push)
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

        AlphEdit.pushHistory(Array("del", args, null), AdjustButtons);
    }
};

/**
 * Create elided node
 * @param {Boolean} a_push whether to push event onto history
 */
function AddElidedNode(a_push)
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
            Array("add", Array(currentNode.attr("id"), i)), AdjustButtons);
    }
};

/**
 * Recreate elided node
 * @param {Number} a_elided elided node number
 * @param {String} a_label arc label
 * @param {Array} a_childIds children to add to new node
 */
function ReAddElidedNode(a_elided, a_label, a_childIds)
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
 * Show next word sequentially
 * @return whether action was performed
 * @type Boolean
 */
function ShowNextWord()
{
    // find next word to reveal
    var hidden = $("g.text text[display='none']", document);
    var id = hidden.eq(0).attr("tbref");
    $("g.text *[tbref='" + id + "']", document).attr("display", "inline");
    $("#" + id, document).attr("display", "inline");
    if (hidden.size() == 1)
    {
        $("#nextword-button", document).attr("disabled", "disabled");
        var button = $("#nextword-button", document);
        $("img", button).attr("src", button.attr("base") + "-disabled.png");
    }
    Reposition();
    return false;
};

/**
 * Show history
 * @return whether action was performed
 * @type Boolean
 */
function ShowHistory()
{
    AlphEdit.showHistory(FormatHistoryEntry);
    return true;
};

/**
 * Format history event
 * @param {Array} a_hEvent history event to format
 * @return displayable representation of event
 * @type String
 */
function FormatHistoryEntry(a_hEvent)
{
    var value = a_hEvent[0] + "(";
    for (i in a_hEvent[1])
    {
        if (i > 0)
            value += ", ";
        value += a_hEvent[1][i];
    }
    value += ")";
    return value;
};

/**
 * Save contents
 * @param {String} a_confirm confirmation message
 * @return whether action was performed
 * @type Boolean
 */
function SaveContents(a_confirm)
{
    // if need to confirm
    if (a_confirm)
    {
        // do nothing if no unsaved changes
        if (!AlphEdit.unsavedChanges())
            return;

        // do nothing if action not confirmed
        if (!confirm(a_confirm))
            return;
    }

    // transform sentence
    s_editTransform.setParameter(null, "e_mode", "svg-to-xml");
    s_editTransform.setParameter(null, "e_app", s_param["app"]);
    
    var doc = document.implementation.createDocument("", "", null);
    doc.appendChild(doc.importNode($("svg", document).get(0), true));
    var xml = s_editTransform.transformToDocument(doc);

    AlphEdit.putContents(xml.documentElement,
                         s_putSentenceURL,
                         s_param["doc"],
                         s_param["s"]);

    // remember where we last saved and fix buttons
    AlphEdit.saved();
    AdjustButtons();
    return true;
};

/**
 * Abort current action
 * @return whether action was performed
 * @type Boolean
 */
function AbortAction()
{
    // if labelling
    if (s_mode == "label")
    {
        // hide menu
        var div = $("#" + s_currentLabelType + "-label-menus", document);
        div.hide();
        s_currentLabelId = null;
        s_currentLabelType = null;
        return true;
    }
    // if dragging
    else if (s_mode == "tree")
    {
        // drop outside of node
        Drop(null);
        return true;
    }

    return false;
};

/**
 * Finish current action
 * @return whether action was performed
 * @type Boolean
 */
function FinishAction()
{
    var retVal = false;

    // if labelling
    if (s_mode == "label")
    {
        switch (s_currentLabelType)
        {
          // if labelling arc
          case "arc":
            // hide menu
            var div = $("#arc-label-menus", document);
            div.hide();

            // set new label
            var newLabel = "";
            var label = $('select[name="arc-label-1"]', div);
            if (label.size() > 0)
                newLabel += label[0].value;
            label = $('select[name="arc-label-2"]', div);
            if (label.size() > 0)
                newLabel += label[0].value;
            LabelArc(s_currentLabelId, newLabel, true);
            Reposition();

            retVal = true;
            break;

          // if labelling node
          case "node":
            // hide menu
            var div = $("#node-label-menus", document);
            var label = $("#" + s_currentLabelId, document);
            div.hide();

            // set new label
            SetLabelFromForm(label, div);

            retVal = true;
            break;
        }

        s_currentLabelId = null;
        s_currentLabelType = null;
    }

    return retVal;
};

/**
 * Reposition everything in tree
 */
function Reposition()
{
    $("body", document).show();
    var rootNode = $("g.tree > g.tree-node", document);
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
        Drop(null);

    // interpret event
    var eventType = a_hEvent[0];
    var eventArgs = a_hEvent[1];
    switch (eventType)
    {
      case "arc":
        // relabel arc
        // event args are (id, old label, new label)
        LabelArc(eventArgs[0], a_forward ? eventArgs[2] : eventArgs[1], false);
        break;

      case "node":
        // restore node values
        SetLabelFromValues(eventArgs[0],
                           a_forward ? eventArgs[3] : eventArgs[1],
                           a_forward ? eventArgs[4] : eventArgs[2]);
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
            ExpandNode(eventArgs[0], expanded, false);
        }
        break;

      case "move":
        // adjust attachment
        // event args are (id being moved, old parent, new parent)
        // if replaying forward, move to new parent
        // if replaying backward, move to old parent
        MoveNode(eventArgs[0], a_forward ? eventArgs[2] : eventArgs[1], false);
        break;

      case "add":
        // add elided node
        if (a_forward)
        {
            s_currentId = eventArgs[0];
            AddElidedNode(false);
        }
        else
        {
            s_currentId =
                $("[elided='" + eventArgs[1] + "']", document).attr("id");
            DelElidedNode(false);
        }
        break;

      case "del":
        // delete elided node
        if (a_forward)
        {
            s_currentId = eventArgs[0];
            DelElidedNode(false);
        }
        else
        {
            s_currentId = eventArgs[1];
            ReAddElidedNode(eventArgs[2],
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

/**
 * Adjust images on buttons for enabled/disabled status
 */
function AdjustButtons()
{
    var name = ["undo", "redo", "save"];
    for (i in name)
    {
        var button = $("#" + name[i] + "-button", document);
        $("img", button).attr("src",
                              button.attr("base") +
                              (button.attr("disabled") ? "-disabled" : "") +
                              ".png");
    }
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
                                 children('g.tree-node[display!="none"]');
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
            // if no children, hide expansion controls
            if (a_container.children("g.tree-node").size() == 0)
            {
                this.setAttribute("display", "none");
                return;
            }

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

            this.setAttribute("display", "inline");
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
    return compareByIdBase(a_a,
                           a_b,
                           (s_param["direction"] == "rtl") ? -1 : 1);
};

/**
 * Position text words:
 *
 * The text words are placed underneath the tree itself, wrapping
 * at the width of the tree (except if the tree is narrow, wrapping
 * at s_minWidth pixels).
 *
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

    // s_minWidth = minimum width allowed for text to avoid excessive wrapping
    var width = (a_width > s_minWidth) ? a_width : s_minWidth;
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
        var xx = (s_param["direction"] == "rtl") ? (width - x - wlen) : x;
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
    $("#dependency-tree", a_doc)[0].setAttribute("width",
                                                 s_expandFactor * width);
    $("#dependency-tree", a_doc)[0].setAttribute("height",
                                                 s_expandFactor * height);
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
        // display everything normally
        $("#dependency-tree", a_doc).children("g:not(.key)")
                                    .find("text, line,rect")
                                    .attr("showme", "normal");
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
    // if id specified
    if (a_id && (a_id.length > 0))
        $("g.text rect[tbref='" + a_id + "']", a_doc).attr("showme", a_focus);
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
    var neighbor = (s_param["direction"] == "rtl") ?
                        current.next("g.tree-node") :
                        current.prev("g.tree-node");
    if (neighbor.size() == 0)
    {
        neighbor = current.siblings("g.tree-node");
        neighbor = neighbor.eq((s_param["direction"] == "rtl") ?
                                    0 :
                                    (neighbor.size() - 1));
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
    var neighbor = (s_param["direction"] == "rtl") ?
                        current.prev("g.tree-node") :
                        current.next("g.tree-node");
    if (neighbor.size() == 0)
    {
        neighbor = current.siblings("g.tree-node");
        neighbor = neighbor.eq((s_param["direction"] == "rtl") ?
                                    (neighbor.size() - 1) :
                                    0);
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

function ClickOnExport(a_evt) {
    s_editTransform.setParameter(null, "e_mode", "svg-to-xml");
    s_editTransform.setParameter(null, "e_app", s_param["app"]);
    var doc = document.implementation.createDocument("", "", null);
    doc.appendChild(doc.importNode($("svg", document).get(0), true));
    var xml = s_editTransform.transformToDocument(doc);
    AlphEdit.ExportContents(xml,s_param['lang'],$(s_tbDesc).parent().attr('format'));
};

function ClickOnExportDisplay(a_evt) {
s_editTransform.setParameter(null, "e_mode", "svg-to-xml");
    s_editTransform.setParameter(null, "e_app", s_param["app"]);
    var doc = document.implementation.createDocument("", "", null);
    doc.appendChild(doc.importNode($("svg", document).get(0), true));
    var xml = s_editTransform.transformToDocument(doc);
    AlphEdit.ExportDisplay(xml,s_param['lang'],$(s_tbDesc).parent().attr('format'));
};
