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
import module namespace tan  = "http://alpheios.net/namespaces/text-analysis"
    at "textanalysis-utils.xquery";
declare namespace treebank="http://nlp.perseus.tufts.edu/syntax/treebank/1.5";
declare namespace oac="http://www.openannotation.org/ns/";
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
  $a_data as node()?,
  $a_docId as xs:string,
  $a_index as xs:integer) as element()*
{
	(: TODO we really need to use namespaced and/or random ids to prevent multiple requests 
	    from trampling on each other 
	:)
    let $dummy := element {QName("http://nlp.perseus.tufts.edu/syntax/treebank/1.5","sentence")} {}
    let $sentences :=
        (: if we've been sent an oac:Annotation, get the treebank data from it :)
        if ($a_data//oac:Annotation)
        then
            let $orig := tan:get_OACTreebank($a_data)//sentence
            for $s at $a_i in $orig return 
                element sentence {
                    attribute id { $a_index + $a_i },
                    attribute n { $s/@id },
                    $s/@*[local-name(.) != 'id' and local-name(.) != 'n'],
                    $s/*
                }
            
        (: else if we've been sent a bare sentence, just use it, stripped of the namespace :)
        else if (name($a_data) = name($dummy))
        then
            let $orig := tan:change-element-ns-deep($a_data,"","")
            for $s at $a_i in $orig return 
                element sentence {
                    attribute id { $a_index + $a_i },
                    attribute n { $s/@id },
                    $s/@*[local-name(.) != 'id' and local-name(.) != 'n'],
                    $s/*
                }
        else 
            let $text := normalize-space($a_data/text())
            return
              element sentence
              {
                attribute id { $a_index + 1 },
                attribute document_id { $a_docId },
                local:createWords($text, 1)
              }
    return $sentences
};

let $data := request:get-data()
let $fmt := request:get-parameter('fmt',$data/@fmt)
let $lang := request:get-parameter('lang',$data/@xml:lang)
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
    (: if document doesn't already exist, create it:)
    let $error := if ( not(doc-available($docName)))
        then
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
            else ()
        else()
    return 
    if ($error)     
    then $error
    else
        let $doc := doc($docName) 
        let $index := count($doc//sentence) 
        let $sentences := local:createSentence($data, $docId, $index)
        return 
        if (count($sentences) > 0)
            then
            let $junk := for $s in $sentences
                return update insert $s into $doc/treebank
            let $s_list := for $s at $a_i in $sentences return xs:string($s/@id)
            return
                element args
                    {
                      attribute doc { $docId },
                      attribute s { string-join($s_list, ' ') }
                    }
         else 
             element error
                {
                  "No sentences found."
                }
            