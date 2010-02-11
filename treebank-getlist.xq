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
declare option exist:serialize
        "method=xhtml media-type=application/xhtml+xml omit-xml-declaration=no indent=yes 
        doctype-public=-//W3C//DTD&#160;XHTML&#160;1.0&#160;Transitional//EN
        doctype-system=http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd";

let $docStem := request:get-parameter("doc", ())
let $startSent := request:get-parameter("i", 1)
let $numSents := request:get-parameter("ns", 5000)
let $numWords := request:get-parameter("nw", 25)
let $collName := "/db/repository/treebank.edit/"
let $docName := concat($collName, $docStem, ".tb.xml")
let $editBase := concat("../app/treebank-editsentence.xhtml",
                        "?doc=",
                        encode-for-uri($docStem),
                        "&amp;s=")

(:
(: see if backup was requested :)
let $backup := request:get-parameter("backup", "n")
let $usets := request:get-parameter("usets", "off")
let $doBackup :=
  if ($backup eq "y")
  then
    albu:do-backup($collName, $docStem, ($usets eq "on"))
  else ()

(: see if restore was requested :)
let $restoreStem := request:get-parameter("restore", ())
let $doRestore :=
  if ($restoreStem)
  then
    albu:do-restore($collName, $docStem, $restoreStem)
  else ()
:)

(: now go get actual list :)
return tblst:get-list-page($docName,
                           $docStem,
                           $editBase,
                           number($numWords),
                           number($startSent),
                           number($numSents))
