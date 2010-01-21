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
  Query to retrieve information about treebank

  Form of request is:
    .../treebank-getinfo.xq?doc=<file>[&desc=y]
  where
    doc is the stem of document file name (without path or extensions)
    desc if present indicates that the format description should be included

  Returns
    <info>
      @numSentences
      @numWords
      @format
      @xml:lang
      <meta> = metadata from format description file
      if desc param present, contents of format description file
 :)

import module namespace request="http://exist-db.org/xquery/request";
import module namespace tbu="http://alpheios.net/namespaces/treebank-util"
              at "treebank-util.xquery";
declare namespace tb = "http://nlp.perseus.tufts.edu/syntax/treebank/1.5";
declare option exist:serialize "method=xml media-type=text/xml";

let $docStem := request:get-parameter("doc", ())
let $docName := concat("/db/repository/treebank.edit/", $docStem, ".tb.xml")
let $desc := request:get-parameter("desc", ())
let $user_info := substring-after($docStem,'user-')

return
  if (not($docStem))
  then
    element error { "Treebank not specified" }
  else if (not(doc-available($docName)) and not($user_info))
    then
      element error { concat("Treebank for ", $docStem, " not available") }
  else
    let $doc := doc($docName)
    let $format := if ($user_info) 
                   then substring-after($user_info,"-")
                   else $doc/(tb:treebank|treebank)/@*:format
    let $format := if ($format) then $format else "aldt"
    let $lang := if ($user_info)
                 then substring-before($user_info,"-")
                 else $doc/(tb:treebank|treebank)/@*:lang
    return
      element info
      {
        attribute numSentences { count($doc//(tb:sentence|sentence)) },
        (: number of words not used, commented out for now
        attribute numWords { count($doc//(tb:word|word)) }, :)
        attribute format { $format },
        attribute direction { if ($lang eq "ara") then "rtl" else "ltr" },
        attribute xml:lang { $lang },

        if ($desc)
        then
          tbu:get-format-description($format, "/db/config")
        else
          tbu:get-format-metadata($format, "/db/config")
      }
