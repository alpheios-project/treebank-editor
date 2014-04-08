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
  Query to put a sentence into treebank

  Form of request is:
    .../tb-get.xq?doc=<file>&s=<id>
  where
    doc is the stem of document file name (without path or extensions)
    s is sentence id

  Request data holds new XML content of sentence
 :)

import module namespace request="http://exist-db.org/xquery/request";
import module namespace util="http://exist-db.org/xquery/util";
declare namespace tb = "http://nlp.perseus.tufts.edu/syntax/treebank/1.5";
declare option exist:serialize "method=xml media-type=text/xml";


declare function local:filter($a_id as xs:string, $to_replace as node(), $replace_with as node()) as node() {
    typeswitch ($to_replace)
        case $my as element(tb:sentence) return
            if ($my/@id = $a_id)
            then
                local:replace_sentence($my,$replace_with)
            else
                element { node-name($my) } {
                    $my/@*, for $child in $my/node() return local:filter($a_id,$child,$replace_with)
                }
        case $other as element(sentence) return
            if ($other/@id = $a_id)
            then
                local:replace_sentence($other,$replace_with)
            else
                element { node-name($other) } {
                    $other/@*, for $child in $other/node() return local:filter($a_id,$child,$replace_with)
                }
        case $elem as element() return
            element { node-name($elem) } {
                $elem/@*, for $child in $elem/node() return local:filter($a_id,$child,$replace_with)
            }
        default return
            $to_replace
};

declare function local:replace_sentence($a_oldSentence as node(),$a_newSentence as node()) as node() {
(: build content in namespace of existing sentence :)
      let $ns := namespace-uri($a_oldSentence)
      let $newSentence :=
        element { QName($ns, "sentence") }
        {
          $a_oldSentence/@*,

          for $elt in $a_newSentence/*
          return
            element { QName($ns, local-name($elt)) }
            {
              $elt/@*,
              $elt/*
            }
        }
     return $newSentence
};

let $sentId := request:get-parameter('s','')
let $data := request:get-data()

return
  if (not($sentId))
  then
    element error { "Sentence not specified" }
  else if (not($data))
  then
    element error { "No data found" }
  else
    let $doc := $data/*:treebank
    let $sentence := $data/*:sentence
    let $oldSentence := 
         ($doc//tb:sentence[@id=$sentId],
       $doc//sentence[@id=$sentId])[1]
    return
    if ($oldSentence and $doc and $sentence)
    then
        local:filter($sentId,$doc,$sentence)
    else
      element error { "Error retrieving sentence to update" }
