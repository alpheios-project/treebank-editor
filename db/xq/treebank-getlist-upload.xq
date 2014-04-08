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

declare option exist:serialize
        "method=xhtml media-type=application/xhtml+xml omit-xml-declaration=no indent=yes 
        doctype-public=-//W3C//DTD&#160;XHTML&#160;1.0&#160;Transitional//EN
        doctype-system=http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd";

(: these following params are not currently used :)
let $startSent := request:get-parameter("i", 1)
let $numSents := request:get-parameter("ns", 5000)
let $numWords := request:get-parameter("nw", 25)
(: end unused params :)

let $hasFile := request:get-uploaded-file-name("newfile")

return
    <html xmlns="http://www.w3.org/1999/xhtml">
    {
        <head>{
            element title
            {
                "Alpheios:User Treebank Sentence List"
            },
            element link
            {
                attribute rel { "stylesheet" },
                attribute type { "text/css" },
                attribute href { "../css/alph-treebank-list.css" }
            },
            element script {
                attribute language { "javascript" },
                attribute type { "text/javascript" },
                attribute src { "../script/jquery-1.2.6-alph.js" }
            },
            element script
            {
                attribute language { "javascript" },
                attribute type { "text/javascript" },
                attribute src { "../script/alph-treebank-list.js" }
            },
            element script
            {
                attribute language { "javascript" },
                attribute type { "text/javascript" },
                attribute src { "../script/alph-treebank-list-local.js" }
            }
        }</head>,
        <body>{
            element div {
                attribute class {"alpheios-ignore"},
                element div {
                    attribute id {"alph-page-header"},
                    element img {
                        attribute src {"../image/alpheios.png"}
                    }
                }
            },
            element div {
                element a {
                    attribute href {"../app/treebank-entertb-local.xhtml"},
                    "<< Return to Upload Form"
                }
            },
            if ($hasFile) then
                    element form {
                        attribute action {"../xq/treebank-editsentence-local.xq"},
                        attribute name {"submit-form"},
                        attribute method {"post"},
                        let $newFile := request:get-uploaded-file-data("newfile")               
                        let $newDocString := util:binary-to-string($newFile,"UTF-8")
                        let $cleaned := replace($newDocString,'<\?xml version="1.0".*?>','')
                        let $newDoc := util:eval(document { $cleaned }) 
                        return
                            if ($newDoc) then 
                                (   
                                    element input {
                                        attribute type { "hidden" },
                                        attribute name { "doc"},
                                        attribute value { $cleaned }
                                    },
                                    element input {
                                        attribute type { "hidden" },
                                        attribute name { "f"},
                                        attribute value { $hasFile }
                                    },
                                    element input {
                                        attribute type { "hidden" },
                                        attribute name { "s"}
                                      
                                    },
                                    (:now go get actual list :)
                                    tblst:get-list-local($newDoc,
                                           $hasFile,
                                           number($numWords),
                                           number($startSent),
                                           number($numSents))
                               )
                            else <div class="error">Invalid file</div>
                    }
            else <div class="error">No filename specified</div>
        }</body>
    }</html>