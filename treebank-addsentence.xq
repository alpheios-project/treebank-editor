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
  Query to add a new sentence into treebank

  Request data holds new sentence in form
    <sentence fmt="<format>" xml:lang="<language>">
      sentence
    </sentence>
  where
    fmt is the name of the treebank format
    lang is the language of the sentence
 :)

import module namespace request="http://exist-db.org/xquery/request";
import module namespace xmldb="http://exist-db.org/xquery/xmldb";
import module namespace util="http://exist-db.org/xquery/util";
declare option exist:serialize "method=xml media-type=text/xml";

declare function local:createWords(
  $a_sent as xs:string?,
  $a_i as xs:integer) as element()*
{
  if (string-length($a_sent) eq 0) then ()
  else
    let $word :=
      if (contains($a_sent, ' '))
      then
        substring-before($a_sent, ' ')
      else
        $a_sent
    return
    (
      element word
      {
        attribute id { $a_i },
        attribute form { $word },
        attribute postag { "-" },
        attribute head { 0 },
        attribute relation { "nil" }
      },
      local:createWords(substring-after($a_sent, ' '), $a_i + 1)
    )
};

declare function local:createSentence(
  $a_sent as xs:string?,
  $a_docId as xs:string,
  $a_index as xs:integer) as element()
{
  let $sent := normalize-space($a_sent)
  return
    element sentence
    {
      attribute id { $a_index },
      attribute document_id { $a_docId },
      local:createWords($sent, 1)
    }
};

let $data := request:get-data()
let $fmt := $data/@fmt
let $lang := $data/@xml:lang
let $collName := "/db/repository/treebank.edit"
let $docId := concat("sentences-", $fmt, '-', $lang)
let $docName := concat($collName, '/', $docId, ".tb.xml")

return
  (: handle various error conditions :)
  if (not($fmt))
  then
    element error { "No format specified" }
  else if (not($lang))
  then
    element error { "No language specified" }
  else if (not($data))
  then
    element error { "No data found" }
  else

  (: if document already exists :)
  if (doc-available($docName))
  then
    let $doc := doc($docName)
    let $index := count($doc//sentence) + 1
    let $junk := update
                    insert local:createSentence($data/text(), $docId, $index)
                    into $doc/treebank
    return
      element args
      {
        attribute doc { $docId },
        attribute s { $index }
      }

  (: if need to create document :)
  else
    let $newDoc :=
      <treebank xmlns:treebank="http://nlp.perseus.tufts.edu/syntax/treebank/1.5"
                xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xsi:schemaLocation="http://nlp.perseus.tufts.edu/syntax/treebank/1.5 treebank-1.5.xsd"
                version="1.5">{
        attribute format { $fmt },
        attribute xml:lang { $lang },
        local:createSentence($data/text(), $docId, 1)
      }</treebank>
    let $stored := xmldb:store($collName, concat($docId, ".tb.xml"), $newDoc)
    return
      if (not($stored))
      then
        element error
        {
          concat("Treebank ", $docId, " could not be created")
        }
      else
        element args
        {
          attribute doc { $docId },
          attribute s { 1 }
        }
