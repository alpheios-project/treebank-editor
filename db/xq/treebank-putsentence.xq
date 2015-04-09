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
    doc and s can also be supplied in the document itself as 
    the following attributes on the <sentence/> element:
    @alph-doc and @alph-s

  Request data holds new XML content of sentence
 :)

import module namespace request="http://exist-db.org/xquery/request";
import module namespace util="http://exist-db.org/xquery/util";
declare namespace tb = "http://nlp.perseus.tufts.edu/syntax/treebank/1.5";
declare option exist:serialize "method=xml media-type=text/xml";

let $data := request:get-data()
(: 
   eXist 1.4.x interprets the put sentence element to be the root of the document 
   eXist 2.x interprets the put sentence element to be the first child of the root
:)
let $sentence := if (local-name($data) = 'sentence') then $data 
                 else if ($data/*:sentence) then $data/*:sentence
                 else ()

let $docStem := 
    if ($sentence/@alph-doc) then $sentence/@alph-doc 
    else request:get-parameter('doc','') 
let $sentId := 
    if ($sentence/@alph-s)then $sentence/@alph-s 
    else request:get-parameter('s','')
let $docName := concat("/db/repository/treebank.edit/", $docStem, ".tb.xml")

return
  if (not($docStem))
  then
    element error { "Treebank not specified" }
  else if (not($sentId))
  then
    element error { "Sentence not specified" }
  else if (not(doc-available($docName)))
  then
    element error { concat("Treebank for ", $docStem, " not available") }
  else if (not($sentence))
  then
    element error { "No data found" }
  else
    let $doc := doc($docName)
    let $oldSentence := 
      (subsequence($doc//tb:sentence, number($sentId), 1),
       subsequence($doc//sentence, number($sentId), 1))[1]
    return
    if ($oldSentence)
    then
    (

      (:
        Copy the old sentence and iterate over each element of the updated
        annotation and its attributes.
        These attributes replace their old counterparts in place - we just
        update the contents of the sentence we received. Documents that
        contain attributes the editor does not know of are therefore retained.
      :)

      let $newSentence := $oldSentence
      for $elt in $sentence/*
        let $id := $elt/@id
        let $name := local-name($elt)
        for $attr in $elt/@*
          let $old_attr :=
            $oldSentence/*[name()=$name and @id=$id]/@*[name()=name($attr)]
          let $update := update replace $old_attr with $attr

      return update replace $oldSentence with $newSentence,
      element message { "Sentence saved" }
    )
    else
      element error { "Error retrieving sentence to update" }
