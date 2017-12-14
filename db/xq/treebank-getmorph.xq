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
  Query to retrieve morphology from treebank

  Form of request is:
    .../tb-getmorph.xq?f=<file>&w=<wd>
  where
    f is the base file name (without path or extensions)
    w is the word id (<sentence#>-<word#>)

  Output is returned as XML in the lexicon format.
 :)

import module namespace request="http://exist-db.org/xquery/request";
import module namespace tbm="http://alpheios.net/namespaces/treebank-morph"
              at "treebank-morph.xquery";
declare option exist:serialize "method=xml media-type=text/xml";

let $base := request:get-parameter("f", ())
let $ids := request:get-parameter("w", ())
let $docname := concat("/db/repository/treebank/", $base, ".tb.xml")

return
  if (not($base))
  then
    element error { "Treebank not specified" }
  else if (not(doc-available($docname)))
  then
    element error { concat("Treebank for ", $base, " not available") }
  else
    tbm:get-morphology(doc($docname), $ids)