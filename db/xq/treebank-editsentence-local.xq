(:
Copyright 2012 The Alpheios Project, Ltd.
http://alpheios.net

This file is part of Alpheios.

Alpheios is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

Alpheios is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
:)

import module namespace request="http://exist-db.org/xquery/request";
import module namespace util="http://exist-db.org/xquery/util";
declare namespace treebank="http://nlp.perseus.tufts.edu/syntax/treebank/1.5";


declare option exist:serialize
"method=xhtml media-type=application/xhtml+xml omit-xml-declaration=no indent=yes 
doctype-public=-//W3C//DTD&#160;XHTML&#160;1.0&#160;Transitional//EN
doctype-system=http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd";

let $startSent := request:get-parameter("s", "1")
let $docString := request:get-parameter("doc","")
let $docName := request:get-parameter("f","")

let $doc := util:eval(document { $docString})
let $format := if ($doc/@format) then $doc/@format else "aldt"
let $lang := $doc/@xml:lang
let $sentence := $doc/*:sentence[@id=$startSent]

return
<html xmlns="http://www.w3.org/1999/xhtml"
  xmlns:svg="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink">
  <head>
    <title>Alpheios:Edit Treebank Sentence</title>
    <meta id="alpheios-pedagogical-text" name="alpheios-pedagogical-text"
      content="true"/>
    <meta name="alpheios-editTransformURL"
      content="../xslt/treebank-svg-edit.xsl"/>
    <link rel="stylesheet" type="text/css" href="../css/alph-treebank-edit.css"/>
    <script language="javascript" type="text/javascript" src="../script/alph-treebank-edit.js"/>
    <script language="javascript" type="text/javascript" src="../script/alph-edit-utils.js"/>
    <script language="javascript" type="text/javascript" src="../script/jquery-1.2.6-alph.js"/>

    <!-- A URL can be supplied that can be used to retrieve information about
         the document and treebank or else the following information should be
         supplied directly in metadata parameters or URL call parameters:
            numSentences (if sentence navigation is desired), lang, direction
         (See below for descriptions of parameters.)
         If the URL is present then it will take precedence over the parameter
         values, so if the parameters are to be used then the URL should be
         commented out.
    -->
    <meta name="alpheios-getInfoURL" content="../xq/treebank-getinfo.xq"/>

    <!-- Parameters controlling behavior of the editor
         All names are prefixed in the <meta> tags with "alpheios-param-".
         All can be overridden by parameters supplied at invocation time to
         the url, using the names below without the "alpheios-param-" prefix.
            app: [editor|viewer]
              Whether we're editing or just viewing the tree.
              If set to "viewer", other parameters controlling editing
              behavior will be ignored.
            numSentences: integer > 0
              Number of sentences in the document.  Only needed if sentence
              navigation is enabled (sentenceNavigation = "yes").
            lang:
              Language of the sentence.
            direction: [ltr|rtl]
              Direction of text flow.
            arcEditing: [yes|no]
              If "yes", allow arc label editing
              and div#label-menus > div#arc-label-menus should be defined
              either explicitly or built from the format description.
            nodeEditing: [yes|no]
              If "yes", allow node label editing
              and div#label-menus > div#node-label-menus should be defined
              either explicitly or built from the format description.
            buildContent:
              What content to build from treebank description.
              This can only be done if the URL to retrieve treebank info
              is supplied above.
              Contains a comma-separated list of possible values:
                menus = menus for arc and/or node label editing
                style = style sheet controlling display of values
                key = key describing values
              If not enabled, the content must be supplied directly in this
              file.  Search for "buildContent" to find the locations.
            sentenceNavigation: [yes|no]
              If "yes", include controls to allow navigation between sentences
              within the editor.  For this to work, the sentence ids must be
              integers running from 1 to maxSentId, where maxSentId is obtained
              either from invoking the alpheios-getInfoURL or from the
              numSentences parameter.
            sequential: [yes|no]
              If "yes", initially only show first word in sentence and enable
              button to reveal next word.
    -->
    <meta name="alpheios-param-app" content="editor"/>
    <meta name="alpheios-param-numSentences" content="1"/>
    <meta name="alpheios-param-lang" content="{$lang}"/>
    <meta name="alpheios-param-direction" content="ltr"/>
    <meta name="alpheios-param-arcEditing" content="yes"/>
    <meta name="alpheios-param-nodeEditing" content="yes"/>
    <meta name="alpheios-param-buildContent" content="menus,style,key"/>
    <meta name="alpheios-param-sentenceNavigation" content="yes"/>
    <meta name="alpheios-param-sequential" content="no"/>
    <meta name="alpheios-param-format" content="{$format}"/>
    <meta name="alpheios-param-doc" content="{concat('user-',$lang,'-',$format)}"/>
    <meta name="alpheios-param-docnamespace" content="{$doc/@xmlns}"/>

    <!-- URLs to get and put a single sentence in treebank XML -->
    <meta name="alpheios-getSentenceURL" content=""/>
    <meta name="alpheios-putSentenceURL" content="../xq/treebank-putsentence-local.xq"/>
    
    <!-- URL to call when exiting and label to use on exit button -->
    <meta name="alpheios-exitURL" content="../xq/treebank-getlist-local.xq"/>
    <meta name="alpheios-exitLabel" content="Sentence&#160;list"/>

    <!-- Provide style here if buildContent param does not contain "style".
         Styles should be provided for
            g text[pos=<pos>]     words in text and tree
            td[pos=<pos>]         words in key
         for each part of speech <pos>.
    -->
    <style type="text/css"/>
  </head>
  <body onkeypress="Keypress(event)" onload="Init(event)" style="display:none">
    <div id="doc-xml" style="display:none;">
        {$doc}
    </div>
    <div id="sentence-xml" data-sentencenum="{$startSent}" style="display:none;">
        {$sentence}
    </div>
    <table style="border:none; padding:0; width:100%">
      <tr>
        <td>
          <div class="controls alpheios-ignore" id="edit-controls">
            <table style="border:none; padding:0">
              <tr>
                <td>
                  <!--div id="sent-navigation">
                    <table style="border:1px solid black; padding:0">
                      <tr>
                        <td>
                          <button id="first-button" onclick="ClickOnGoTo(event)"
                            >&#160;</button>
                        </td>
                        <td>
                          <button id="prev-button" onclick="ClickOnGoTo(event)"
                            >&#160;</button>
                        </td>
                        <td>
                          <label id="current-label">&#160;</label>
                        </td>
                        <td>
                          <button id="next-button" onclick="ClickOnGoTo(event)"
                            >&#160;</button>
                        </td>
                        <td>
                          <button id="last-button" onclick="ClickOnGoTo(event)"
                            >&#160;</button>
                        </td>
                        <td>
                          <form onsubmit="return SubmitGoTo(this)"
                            name="sent-navigation-goto">
                            <label>&#160;&#160;Go&#160;to&#160;sentence&#160;number</label>
                            <input type="text" name="s" size="5"/>
                          </form>
                        </td>
                      </tr>
                    </table>
                  </div-->
                </td>
                <td>
                  <form onsubmit="return SubmitExit(this)" id="sent-navigation-exit"
                    name="sent-navigation-exit" method="post">
                    <input type="hidden" name="docString" id="docForList" value="{$docString}"/>
                    <input type="hidden" name="docName" value="{$docName}"/>
                    <input type="hidden" name="s"/>
                    <button type="submit">Exit</button>
                  </form>
                </td>
              </tr>
            </table>
            <table style="border:none; padding:0">
              <tr>
                <td>
                  <table style="border:none; padding:0">
                    <tr>
                      <button id="tree-button" class="icon mode-button"
                        value="tree" checked="checked"
                        onclick="ClickOnMode(event)" title="Tree tool">
                        <img src="../image/edit-tool-tree.png" alt="⽊"/>
                      </button>
                      <button id="label-button" class="icon mode-button"
                        value="label" onclick="ClickOnMode(event)"
                        title="Label tool">
                        <img src="../image/edit-tool-label.png" alt="✍"/>
                      </button>
                      <button id="ellipsis-button" class="icon mode-button"
                        value="ellipsis" onclick="ClickOnMode(event)"
                        title="Ellipsis tool">
                        <img src="../image/edit-tool-ellipsis.png" alt="…"/>
                      </button>
                    </tr>
                  </table>
                </td>
                <td>
                  <button id="expansion-checkbox" class="icon" checked="checked"
                    onclick="ShowExpansionControls(event)"
                    title="Show expansion controls">
                    <img src="../image/edit-expansion-controls.png" alt="⇅"/>
                  </button>
                </td>
                <td>
                  <table style="border:none; padding:0">
                    <tr>
                      <button id="undo-button" disabled="disabled" class="icon"
                        onclick="ClickOnUndo(event)" title="Undo"
                        base="../image/edit-undo">
                        <img src="../image/edit-undo-disabled.png" alt="⟲"/>
                      </button>
                      <button id="redo-button" disabled="disabled" class="icon"
                        onclick="ClickOnRedo(event)" title="Redo"
                        base="../image/edit-redo">
                        <img src="../image/edit-redo-disabled.png" alt="⟳"/>
                      </button>
                    </tr>
                  </table>
                </td>
                <td>
                  <form method="post" action="{concat("treebank-export.xq?doc=",$docName)}" id="exportform">
                  <button id="export-xml-button" disabled="disabled" class="icon"
                    onclick="ClickOnExport(event)" title="Export sentence XML">Export XML</button>
                  <button id="export-svg-button" disabled="disabled" class="icon"
                    onclick="ClickOnExportDisplay(event)" title="Export sentence display">Export XML</button>
                  <input type="hidden" name="docForExport" id="docForExport"/>
                  <input type="hidden" name="docName" value="{$docName}"/>
                  </form>
                </td>
                <td>
                  <button id="nextword-button" class="icon mode-button"
                    value="nextword" onclick="ClickOnNextWord(event)"
                    base="../image/list-add" title="Show next word">
                    <img src="../image/list-add.png" alt="+"/>
                  </button>
                </td>
              </tr>
            </table>
            <!-- Provide menus here if buildContent param does not contain "menus" -->
            <div id="label-menus"/>
          </div>
        </td>
        <td style="vertical-align:top; text-align:right">
          <div class="alpheios-ignore" id="alph-page-header">
            <img src="../image/alpheios.png" alt="Alpheios"/>
          </div>
        </td>
      </tr>
    </table>
    <div id="tree-error"/>
    <div id="tree-hint" class="alpheios-hint"/>
    <div id="alpheios-trigger-hint" class="alpheios-ignore alpheios-trigger-hint alpheios-hint"/>    
    <svg xmlns="http://www.w3.org/2000/svg" id="dependency-tree"/>
    <!-- Provide key here if buildContent param does not contain "key" -->
    <div id="key"/>
  </body>
</html>
