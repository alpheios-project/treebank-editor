(:
  Copyright 2009 Cantus Foundation
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

(:
  Create HTML page with list of initial parts of treebank sentences
 :)

import module namespace request="http://exist-db.org/xquery/request";
import module namespace tblst="http://alpheios.net/namespaces/treebank-list"
              at "treebank-getlist.xquery";
import module namespace util="http://exist-db.org/xquery/util";
declare namespace xh="http://www.w3.org/1999/xhtml";

declare option exist:serialize
        "method=xhtml media-type=application/xhtml+xml omit-xml-declaration=no indent=yes 
        doctype-public=-//W3C//DTD&#160;XHTML&#160;1.0&#160;Transitional//EN
        doctype-system=http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd";

(: these following params are not currently used :)
let $startSent := request:get-parameter("i", 1)
let $numSents := request:get-parameter("ns", 5000)
let $numWords := request:get-parameter("nw", 25)
(: end unused params :)

let $hasFile := request:get-uploaded-file-name("upload")
let $tempTb := 
    if ($hasFile) then
        let $upload := request:get-uploaded-file-data("upload")               
        let $docString := util:binary-to-string($upload,"UTF-8")
        let $cleaned := replace($docString,'<\?xml version="1.0".*?>','')
        (: this is probably not completely safe, but is an attempt to make sure
            we only eval treebank documents :)
        let $doc := if (matches($cleaned,'^\s*<(\w+:)?treebank') and
                        matches($cleaned,'</(\w+:)?treebank>\s*$'))
                    then util:eval(document { $cleaned })
                    else ()
        let $sentence :=
            $doc//*:sentence[@id=$startSent]
        let $fmt := if ($doc/@format) then $doc/@format else $doc/*:treebank/@format
        let $lang := if ($doc/@xml:lang) then $doc/@xml:lang else $doc/*:treebank/@xml:lang
        return 
            if ($sentence and $fmt and $lang) then
                (: TODO we need to support other namespaces here :)
               <treebank xmlns:treebank="http://nlp.perseus.tufts.edu/syntax/treebank/1.5"
                    version="1.5">{
                attribute format { $fmt },
                attribute xml:lang { $lang },
                $sentence
              }</treebank>
            else 
                let $msg :=
                    if ($doc and not($sentence)) 
                    then "requested sentence not found"
                    else "invalid treebank file"
                return element error { $msg , $cleaned}
    else 
        element error
        {
            "No file selected."
        }
let $html := doc('/db/app/treebank-editsentence.xhtml')
return
    <html xmlns="http://www.w3.org/1999/xhtml"
        xmlns:svg="http://www.w3.org/2000/svg"
        xmlns:xlink="http://www.w3.org/1999/xlink">
    {
        <head> {
            $html//xh:head/*,
            <meta name="alpheios-param-format" content="{$tempTb/@format}"/>,
            <meta name="alpheios-param-doc" content="{concat('user-',$tempTb/@xml:lang,'-',$tempTb/@format)}"/>
        }</head>,
        <body onkeypress="Keypress(event)" onload="Init(event)" style="display:none"> {
            $html//xh:body/*,
            <div id="sentence-xml" style="display: none;">{$tempTb}</div>
        } </body>
    }
    </html>