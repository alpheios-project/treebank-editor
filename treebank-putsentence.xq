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

let $data := request:get-data()
let $docStem := $data/@alph-doc
let $sentId := $data/@alph-s
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
  else if (not($data))
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
      (: build content in namespace of existing sentence :)
      let $ns := namespace-uri($oldSentence)
      let $newSentence :=
        element { QName($ns, "sentence") }
        {
          $oldSentence/@*,

          for $elt in $data/*
          return
            element { QName($ns, local-name($elt)) }
            {
              $elt/@*,
              $elt/*
            }
        }
      return update replace $oldSentence with $newSentence,
      element message { "Sentence saved" }
    )
    else
      element error { "Error retrieving sentence to update" }
