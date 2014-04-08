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
  Query to retrieve a sentence from treebank

  Form of request is:
    .../tb-get.xq?doc=<file>&s=<id>
  where
    doc is the stem of document file name (without path or extensions)
    s is sentence id
 :)

import module namespace request="http://exist-db.org/xquery/request";
declare namespace tb = "http://nlp.perseus.tufts.edu/syntax/treebank/1.5";
declare option exist:serialize "method=xml media-type=text/xml";

let $docStem := request:get-parameter("doc", ())
let $sentNum := request:get-parameter("s", ())
let $sentId := request:get-parameter("id", ())
let $app := request:get-parameter("app", ())
let $docName := concat("/db/repository/",
                       if ($app eq "viewer")
                       then
                         "treebank/"
                       else
                         "treebank.edit/",
                       $docStem,
                       ".tb.xml")

return
  if (not($docStem))
  then
    element error { "Treebank not specified" }
  else if (not($sentNum) and not($sentId))
  then
    element error { "Sentence not specified" }
  else if ($sentNum and $sentId)
  then
    element error
    {
      concat("Can't specify both id (",
             $sentId,
             ") and number (",
             $sentNum,
             ") for sentence")
    }
  else if (not(doc-available($docName)))
  then
    element error { concat("Treebank for ", $docStem, " not available") }
  else
    let $doc := doc($docName)
    let $sentence :=
      if ($sentNum)
      then
        let $num := number($sentNum)
        return ($doc//(tb:sentence|sentence))[$num]
      else
        $doc//(tb:sentence|sentence)[@*:id = $sentId]
    return
      if ($sentence)
      then
        element tb:sentence
        {
          attribute maxSentId { count($doc//sentence) },
          $sentence/@*,
          for $e in $sentence/*
          return
            element { concat("tb:", local-name($e)) }
            {
              $e/@*,
              $e/*
            }
        }
      else
        element error
        {
          concat("Sentence",
                 if ($sentNum) then " number " else " with id ",
                 if ($sentNum) then $sentNum   else $sentId,
                 " not found")
        }