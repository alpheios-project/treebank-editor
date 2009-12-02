<?xml version="1.0" encoding="UTF-8"?>
<!--
  Copyright 2008-2009 Cantus Foundation
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
-->
<!--
  Convert sentence between treebank format and SVG suitable for editing

  xml-to-svg:
  Output is returned as a tree in SVG format with nodes corresponding to words
  in the sentence and arcs corresponding to dependency relations between words.
  There is a synthetic root node, with all words not dependent on any other
  in the sentence as its immediate children.

  At each level, the immediate children of a node are those that correspond to
  words dependent on that node's word.

  It is the responsibility of the caller to add line, text, and rectangle
  elements as desired and to position the elements for display.

  svg-to-xml:
  Output is returned as a sentence element with a list of words as children.

  desc-to-menus:
  Builds html menus from treebank description

  desc-to-style:
  Builds style from treebank description
 -->
<xsl:stylesheet xmlns="http://www.w3.org/2000/svg"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:tb="http://nlp.perseus.tufts.edu/syntax/treebank/1.5"
  xmlns:svg="http://www.w3.org/2000/svg"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"
  xmlns:tbd="http://alpheios.net/namespaces/treebank-desc"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  xmlns:exsl="http://exslt.org/common" version="1.0"
  exclude-result-prefixes="xs">

  <!--
    External parameters:
      e_mode    mode: xml-to-svg  transform treebank xml to svg
                      svg-to-xml  transform svg to treebank xml
                      menus       generate menus from format description
                      style       generate style from format description
                      key         generate key from format description
      e_app     application ("edit" or "view")
  -->
  <xsl:param name="e_mode"/>
  <xsl:param name="e_app" select="edit"/>

  <!--
    Template for external calls
    Calls appropriate template according to mode
  -->
  <xsl:template match="/">
    <xsl:choose>
      <xsl:when test="$e_mode = 'xml-to-svg'">
        <xsl:call-template name="xml-to-svg">
          <xsl:with-param name="a_sentence" select="sentence"/>
        </xsl:call-template>
      </xsl:when>
      <xsl:when test="$e_mode = 'svg-to-xml'">
        <xsl:call-template name="svg-to-xml">
          <xsl:with-param name="a_sentence" select="svg:svg"/>
        </xsl:call-template>
      </xsl:when>
      <xsl:when test="$e_mode = 'menus'">
        <xsl:call-template name="desc-to-menus">
          <xsl:with-param name="a_desc" select="info/tbd:desc"/>
        </xsl:call-template>
      </xsl:when>
      <xsl:when test="$e_mode = 'style'">
        <xsl:call-template name="desc-to-style">
          <xsl:with-param name="a_desc" select="info/tbd:desc"/>
        </xsl:call-template>
      </xsl:when>
      <xsl:when test="$e_mode = 'key'">
        <xsl:call-template name="desc-to-key">
          <xsl:with-param name="a_desc" select="info/tbd:desc"/>
          <xsl:with-param name="a_app" select="$e_app"/>
        </xsl:call-template>
      </xsl:when>
    </xsl:choose>
  </xsl:template>

  <!--
    Function to convert sentence from treebank XML to SVG

    Parameters:
      $a_sentence     treebank sentence

    Return value:
      svg element containing SVG equivalent of sentence
  -->
  <xsl:template name="xml-to-svg">
    <xsl:param name="a_sentence"/>

    <!-- get undeduped list of words -->
    <xsl:variable name="raw">
      <xsl:call-template name="fix-words">
        <xsl:with-param name="a_words" select="$a_sentence/word"/>
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="rawwords" select="exsl:node-set($raw)/*"/>

    <!-- remove duplicate words -->
    <xsl:variable name="raw2">
      <xsl:for-each select="$rawwords">
        <xsl:variable name="curPos" select="position()"/>
        <xsl:variable name="test">
          <xsl:for-each select="$rawwords">
            <xsl:variable name="newPos" select="position()"/>
            <!-- if this is preceding inflection -->
            <xsl:if test="$curPos &gt; $newPos">
              <!-- and same values -->
              <xsl:if test="
                (string($rawwords[$curPos]/@id) =
                 string($rawwords[$newPos]/@id)) and
                (string($rawwords[$curPos]/@relation) =
                 string($rawwords[$newPos]/@relation))">
                <!-- flag it -->
                <xsl:text>1</xsl:text>
              </xsl:if>
            </xsl:if>
          </xsl:for-each>
        </xsl:variable>
        <!-- if this is inflection we haven't seen yet -->
        <xsl:if test="string-length($test) = 0">
          <xsl:copy-of select="."/>
        </xsl:if>
      </xsl:for-each>
    </xsl:variable>
    <xsl:variable name="words" select="exsl:node-set($raw2)/*"/>
    <xsl:if test="count($words)">
      <xsl:element name="svg">
        <!-- synthetic root -->
        <xsl:variable name="rootword">
          <xsl:element name="g">
            <xsl:attribute name="id">0</xsl:attribute>
            <xsl:attribute name="form">#</xsl:attribute>
          </xsl:element>
        </xsl:variable>

        <!-- tree structure -->
        <xsl:element name="g">
          <xsl:attribute name="class">tree</xsl:attribute>
          <xsl:copy-of select="$a_sentence/@id"/>
          <xsl:call-template name="word-set">
            <xsl:with-param name="a_sentenceId" select="$a_sentence/@id"/>
            <xsl:with-param name="a_allwords" select="$words"/>
            <xsl:with-param name="a_words" select="exsl:node-set($rootword)/*"/>
          </xsl:call-template>
        </xsl:element>

        <!-- text words -->
        <xsl:element name="g">
          <xsl:attribute name="class">text</xsl:attribute>
          <xsl:for-each select="$words">
            <xsl:if test="not(@elided) and (@postag != '0')">
              <xsl:variable name="tbref"
                select="concat($a_sentence/@id, '-', @id)"/>
              <xsl:element name="rect">
                <xsl:attribute name="class">highlight</xsl:attribute>
                <xsl:attribute name="tbref">
                  <xsl:value-of select="$tbref"/>
                </xsl:attribute>
              </xsl:element>
              <xsl:element name="text">
                <xsl:attribute name="class">text-word</xsl:attribute>
                <xsl:attribute name="tbref">
                  <xsl:value-of select="$tbref"/>
                </xsl:attribute>
                <xsl:value-of select="concat('&#160;', @form)"/>
              </xsl:element>
            </xsl:if>
          </xsl:for-each>
        </xsl:element>
      </xsl:element>
    </xsl:if>
  </xsl:template>

  <!--
    Function to process set of words

    Parameters:
      $a_sentenceId   sentence containing words
      $a_allwords     all words in sentence
      $a_words        words to process

    Return value:
      SVG equivalent of words
  -->
  <xsl:template name="word-set">
    <xsl:param name="a_sentenceId"/>
    <xsl:param name="a_allwords"/>
    <xsl:param name="a_words"/>

    <!-- for each word -->
    <xsl:for-each select="$a_words">
      <!-- get child words that depend on this -->
      <xsl:variable name="id">
        <xsl:value-of select="@id"/>
      </xsl:variable>
      <xsl:variable name="children" select="$a_allwords[@head = $id]"/>

      <!-- return group -->
      <xsl:element name="g">
        <!-- attributes -->
        <xsl:attribute name="class">
          <xsl:text>tree-node</xsl:text>
        </xsl:attribute>
        <xsl:attribute name="id">
          <xsl:value-of select="concat($a_sentenceId, '-', @id)"/>
        </xsl:attribute>
        <xsl:copy-of select="@elided|@lemma|@postag"/>
        <xsl:attribute name="expanded">yes</xsl:attribute>

        <!-- arc label, if not root word -->
        <xsl:element name="rect">
          <xsl:attribute name="class">arc-highlight</xsl:attribute>
        </xsl:element>
        <xsl:if test="@id != '0'">
          <xsl:element name="text">
            <xsl:attribute name="class">
              <xsl:text>arc-label alpheios-ignore</xsl:text>
            </xsl:attribute>
            <xsl:choose>
              <xsl:when test="@relation">
                <xsl:value-of select="@relation"/>
              </xsl:when>
              <xsl:otherwise>
                <xsl:text>nil</xsl:text>
              </xsl:otherwise>
            </xsl:choose>
          </xsl:element>
        </xsl:if>

        <!-- line -->
        <xsl:element name="line"/>

        <!-- node label -->
        <xsl:element name="rect">
          <xsl:attribute name="class">highlight</xsl:attribute>
        </xsl:element>
        <xsl:element name="text">
          <xsl:attribute name="class">
            <xsl:text>node-label</xsl:text>
          </xsl:attribute>
          <xsl:if test="@postag">
            <xsl:attribute name="pos">
              <xsl:value-of select="substring(@postag, 1, 1)"/>
            </xsl:attribute>
          </xsl:if>
          <xsl:value-of select="@form"/>
        </xsl:element>

        <!-- expansion control -->
        <xsl:element name="g">
          <xsl:attribute name="class">expand</xsl:attribute>
          <xsl:element name="rect"/>
          <xsl:element name="text">˄</xsl:element>
        </xsl:element>

        <!-- groups for children -->
        <xsl:call-template name="word-set">
          <xsl:with-param name="a_sentenceId" select="$a_sentenceId"/>
          <xsl:with-param name="a_allwords" select="$a_allwords"/>
          <xsl:with-param name="a_words" select="$children"/>
        </xsl:call-template>
      </xsl:element>
    </xsl:for-each>
  </xsl:template>

  <!--
    Function to fix up words in a sentence

    Parameters:
      $a_words      words in sentence

    Return value:
      word set with extra words added for ellipses
  -->
  <xsl:template name="fix-words">
    <xsl:param name="a_words"/>
    <xsl:for-each select="$a_words">
      <xsl:choose>
        <xsl:when test="contains(@relation, '_ExD')">
          <xsl:variable name="rel1">
            <xsl:call-template name="substring-before-last">
              <xsl:with-param name="a_in" select="@relation"/>
              <xsl:with-param name="a_sub" select="'_ExD'"/>
            </xsl:call-template>
          </xsl:variable>
          <xsl:variable name="tail">
            <xsl:call-template name="substring-after-last">
              <xsl:with-param name="a_in" select="@relation"/>
              <xsl:with-param name="a_sub" select="'_ExD'"/>
            </xsl:call-template>
          </xsl:variable>
          <xsl:variable name="tnum" select="substring-before($tail, '_')"/>
          <xsl:variable name="num">
            <xsl:choose>
              <xsl:when test="string-length($tnum) &gt; 0">
                <xsl:value-of select="$tnum"/>
              </xsl:when>
              <xsl:otherwise>0</xsl:otherwise>
            </xsl:choose>
          </xsl:variable>
          <xsl:variable name="rel2" select="substring-after($tail, '_')"/>

          <!-- create synthetic node -->
          <xsl:element name="word">
            <xsl:attribute name="id">
              <xsl:value-of select="concat(@head, '-', $num)"/>
            </xsl:attribute>
            <xsl:attribute name="elided">
              <xsl:value-of select="$num"/>
            </xsl:attribute>
            <xsl:attribute name="form">
              <xsl:value-of select="concat('[', $num, ']')"/>
            </xsl:attribute>
            <xsl:attribute name="head">
              <xsl:value-of select="@head"/>
            </xsl:attribute>
            <xsl:attribute name="relation">
              <xsl:value-of select="$rel2"/>
            </xsl:attribute>
          </xsl:element>
          <!-- point word at synthetic node -->
          <xsl:variable name="new">
            <xsl:element name="word">
              <xsl:copy-of select="@id|@elided|@form|@lemma|@postag"/>
              <xsl:attribute name="head">
                <xsl:value-of select="concat(@head, '-', $num)"/>
              </xsl:attribute>
              <xsl:attribute name="relation">
                <xsl:value-of select="$rel1"/>
              </xsl:attribute>
            </xsl:element>
          </xsl:variable>
          <!-- and fix it -->
          <xsl:call-template name="fix-words">
            <xsl:with-param name="a_words" select="exsl:node-set($new)/*"/>
          </xsl:call-template>
        </xsl:when>
        <xsl:otherwise>
          <xsl:element name="word">
            <xsl:copy-of select="@*"/>
            <xsl:copy-of select="*"/>
          </xsl:element>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:for-each>
  </xsl:template>

  <!--
    Functions to find last instance of substring

    Parameters:
      $a_in       text
      $a_sub      substring to find

    Return value:
      portion of text before/after last occurrence of substring
  -->
  <xsl:template name="substring-after-last">
    <xsl:param name="a_in"/>
    <xsl:param name="a_sub"/>

    <!-- reverse strings -->
    <xsl:variable name="rin">
      <xsl:call-template name="reverse-string">
        <xsl:with-param name="a_in" select="$a_in"/>
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="rsub">
      <xsl:call-template name="reverse-string">
        <xsl:with-param name="a_in" select="$a_sub"/>
      </xsl:call-template>
    </xsl:variable>

    <!-- find first instance and reverse it -->
    <xsl:call-template name="reverse-string">
      <xsl:with-param name="a_in" select="substring-before($rin, $rsub)"/>
    </xsl:call-template>
  </xsl:template>
  <xsl:template name="substring-before-last">
    <xsl:param name="a_in"/>
    <xsl:param name="a_sub"/>

    <!-- reverse strings -->
    <xsl:variable name="rin">
      <xsl:call-template name="reverse-string">
        <xsl:with-param name="a_in" select="$a_in"/>
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="rsub">
      <xsl:call-template name="reverse-string">
        <xsl:with-param name="a_in" select="$a_sub"/>
      </xsl:call-template>
    </xsl:variable>

    <!-- find first instance and reverse it -->
    <xsl:call-template name="reverse-string">
      <xsl:with-param name="a_in" select="substring-after($rin, $rsub)"/>
    </xsl:call-template>
  </xsl:template>

  <!--
    Function to reverse a string

    Parameters:
      $a_in       text to reverse

    Return value:
      string with characters reversed
  -->
  <xsl:template name="reverse-string">
    <xsl:param name="a_in"/>
    <xsl:variable name="len" select="string-length($a_in)"/>
    <xsl:if test="$len &gt; 0">
      <xsl:value-of select="substring($a_in, $len, 1)"/>
      <xsl:call-template name="reverse-string">
        <xsl:with-param name="a_in" select="substring($a_in, 1, $len - 1)"/>
      </xsl:call-template>
    </xsl:if>
  </xsl:template>

  <!--
    Function to convert sentence from SVG to treebank XML

    Parameters:
      $a_sentence     treebank sentence in SVG

    Return value:
      sentence element containing treebank equivalent of sentence
  -->
  <xsl:template name="svg-to-xml">
    <xsl:param name="a_sentence"/>
    <xsl:element name="sentence" namespace="">
      <xsl:copy-of select="$a_sentence/@alph-doc"/>
      <xsl:copy-of select="$a_sentence/@alph-sentid"/>
      <xsl:for-each select="$a_sentence//svg:g[contains(@class, 'tree-node')]">
        <xsl:sort select="substring-after(@id, '-')" data-type="number"/>
        <xsl:variable name="num" select="substring-after(@id, '-')"/>
        <xsl:if test="not(@elided) and ($num != '0')">
          <xsl:variable name="nodeLabel"
            select="svg:text[contains(@class, 'node-label')]"/>
          <xsl:variable name="arcLabel"
            select="svg:text[contains(@class, 'arc-label')]"/>
          <xsl:element name="word" namespace="">
            <xsl:attribute name="id">
              <xsl:value-of select="$num"/>
            </xsl:attribute>
            <xsl:attribute name="form">
              <xsl:choose>
                <!-- form attribute if present has original form -->
                <xsl:when test="$nodeLabel/@form">
                  <xsl:value-of select="$nodeLabel/@form"/>
                </xsl:when>
                <xsl:otherwise>
                  <xsl:value-of select="$nodeLabel/text()"/>
                </xsl:otherwise>
              </xsl:choose>
            </xsl:attribute>
            <xsl:copy-of select="@lemma|@postag"/>
            <xsl:variable name="depInfo">
              <xsl:call-template name="get-dependency-info">
                <xsl:with-param name="a_relation">
                  <xsl:choose>
                    <xsl:when test="$arcLabel != 'nil'">
                      <xsl:value-of select="$arcLabel"/>
                    </xsl:when>
                    <xsl:otherwise>
                      <xsl:text/>
                    </xsl:otherwise>
                  </xsl:choose>
                </xsl:with-param>
                <xsl:with-param name="a_head" select=".."/>
              </xsl:call-template>
            </xsl:variable>
            <xsl:attribute name="head">
              <xsl:value-of select="substring-before($depInfo, '|')"/>
            </xsl:attribute>
            <xsl:attribute name="relation">
              <xsl:value-of select="substring-after($depInfo, '|')"/>
            </xsl:attribute>
          </xsl:element>
        </xsl:if>
      </xsl:for-each>
    </xsl:element>
  </xsl:template>

  <!--
    Function to get dependency relation and head word id,
    taking elided words into account

    Parameters:
      $a_relation     relation so far
      $a_head         possible head word

    Return value:
      head id and dependency relation for word, joined by |
  -->
  <xsl:template name="get-dependency-info">
    <xsl:param name="a_relation"/>
    <xsl:param name="a_head"/>
    <xsl:choose>
      <!-- if this is an elided word -->
      <xsl:when test="$a_head/@elided">
        <xsl:variable name="arcLabel"
          select="$a_head/svg:text[contains(@class, 'arc-label')]"/>
        <!-- concatenate elided node info and ascend -->
        <xsl:call-template name="get-dependency-info">
          <xsl:with-param name="a_relation"
            select="concat($a_relation,
                           '_ExD',
                           $a_head/@elided,
                           '_',
                           $arcLabel/text())"/>
          <xsl:with-param name="a_head" select="$a_head/.."/>
        </xsl:call-template>
      </xsl:when>
      <!-- if not elided -->
      <xsl:otherwise>
        <!-- use our word number and relation so far -->
        <xsl:value-of select="concat(substring-after($a_head/@id, '-'),
                                     '|',
                                     $a_relation)"/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <!--
    Function to create menus from format description

    Parameters:
      $a_desc     treebank format description

    Return value:
      html menus
  -->
  <xsl:template name="desc-to-menus">
    <xsl:param name="a_desc"/>

    <xsl:element name="form" namespace="http://www.w3.org/1999/xhtml">
      <xsl:attribute name="name">menus</xsl:attribute>
      <xsl:element name="div" namespace="http://www.w3.org/1999/xhtml">
        <xsl:text>Dependency Relation: </xsl:text>
      </xsl:element>
      <xsl:variable name="entries1"
        select="$a_desc/tbd:table[@type = 'relation']/tbd:entry"/>
      <xsl:if test="count($entries1)">
        <xsl:element name="select" namespace="http://www.w3.org/1999/xhtml">
          <xsl:attribute name="name">
            <xsl:text>arcrel1</xsl:text>
          </xsl:attribute>
          <xsl:for-each select="$entries1">
            <xsl:element name="option" namespace="http://www.w3.org/1999/xhtml">
              <xsl:attribute name="value">
                <xsl:value-of select="./tbd:tb"/>
              </xsl:attribute>
              <xsl:choose>
                <xsl:when test="./tbd:menu">
                  <xsl:value-of select="./tbd:menu"/>
                </xsl:when>
                <xsl:otherwise>
                  <xsl:value-of select="./tbd:tb"/>
                </xsl:otherwise>
              </xsl:choose>
            </xsl:element>
          </xsl:for-each>
        </xsl:element>
      </xsl:if>
      <xsl:variable name="entries2"
        select="$a_desc/tbd:table[@type = 'subrelation']/tbd:entry"/>
      <xsl:if test="count($entries2)">
        <xsl:element name="select" namespace="http://www.w3.org/1999/xhtml">
          <xsl:attribute name="name">
            <xsl:text>arcrel2</xsl:text>
          </xsl:attribute>
          <xsl:for-each select="$entries2">
            <xsl:element name="option" namespace="http://www.w3.org/1999/xhtml">
              <xsl:attribute name="value">
                <xsl:value-of select="./tbd:tb"/>
              </xsl:attribute>
              <xsl:choose>
                <xsl:when test="./tbd:menu">
                  <xsl:value-of select="./tbd:menu"/>
                </xsl:when>
                <xsl:otherwise>
                  <xsl:value-of select="./tbd:tb"/>
                </xsl:otherwise>
              </xsl:choose>
            </xsl:element>
          </xsl:for-each>
        </xsl:element>
      </xsl:if>
    </xsl:element>
  </xsl:template>

  <!--
    Function to create style from format description

    Parameters:
      $a_desc     treebank format description

    Return value:
      html style tag
  -->
  <xsl:template name="desc-to-style">
    <xsl:param name="a_desc"/>

    <xsl:variable name="entries"
      select="$a_desc/tbd:table[@type = 'morphology']/
              tbd:category[@id = 'pos']/tbd:entry"/>

    <xsl:element name="style" namespace="http://www.w3.org/1999/xhtml">
      <xsl:attribute name="type">text/css</xsl:attribute>
      <!-- for each part of speech -->
      <xsl:for-each select="$entries[tbd:color|tbd:style]">
        <xsl:variable name="subselector"
          select="concat('[pos=', ./tbd:short, ']')"/>
        <!-- if color specified -->
        <xsl:if test="./tbd:color">
          <!-- svg -->
          <xsl:value-of select="concat('g text', $subselector, '{')"/>
          <xsl:value-of select="concat('fill:', ./tbd:color)"/>
          <xsl:value-of select="'}&#10;'"/>
          <!-- key -->
          <xsl:value-of select="concat('td', $subselector, '{')"/>
          <xsl:value-of select="concat('color:', ./tbd:color)"/>
          <xsl:value-of select="'}&#10;'"/>
        </xsl:if>
        <!-- if additional style specified -->
        <xsl:if test="./tbd:style">
          <!-- svg -->
          <xsl:value-of select="concat('g text', $subselector, '{')"/>
          <xsl:value-of select="./tbd:style"/>
          <xsl:value-of select="'}&#10;'"/>
          <!-- key -->
          <xsl:value-of select="concat('td', $subselector, '{')"/>
          <xsl:value-of select="./tbd:style"/>
          <xsl:value-of select="'}&#10;'"/>
        </xsl:if>
      </xsl:for-each>
    </xsl:element>
  </xsl:template>

  <!--
    Function to create key from format description

    Parameters:
      $a_desc     treebank format description

    Return value:
      html table containing key
  -->
  <xsl:template name="desc-to-key">
    <xsl:param name="a_desc"/>
    <xsl:param name="a_app"/>

    <xsl:variable name="entries"
      select="$a_desc/tbd:table[@type = 'morphology']/
      tbd:category[@id = 'pos']/tbd:entry"/>

    <table xmlns="http://www.w3.org/1999/xhtml">
      <thead>
        <tr><th>Key to Background Colors</th></tr>
      </thead>
      <tbody>
        <tr><td showme="focus">Focus word</td></tr>
        <tr><td showme="focus-parent">Word that focus word depends on</td></tr>
        <tr><td showme="focus-child">Words that immediately depend on focus word</td></tr>
        <tr><td showme="focus-descendant">Other words that depend on focus word</td></tr>
        <xsl:if test="$e_app = 'view'">
          <tr><td first="yes">First selected word(s)</td></tr>
        </xsl:if>
      </tbody>
      <br/>
      <thead>
        <tr><th>Key to Text Colors</th></tr>
      </thead>
      <tbody>
        <!-- for each part of speech -->
        <xsl:for-each select="$entries">
          <xsl:sort select="./tbd:long"/>
          <!-- if color specified -->
          <xsl:if test="./tbd:color">
            <xsl:element name="tr">
              <xsl:element name="td">
                <xsl:attribute name="pos">
                  <xsl:value-of select="./tbd:short"/>
                </xsl:attribute>
                <xsl:value-of
                  select="concat(translate(substring(./tbd:long, 1, 1),
                                           'abcdefghijklmnopqrstuvwxyz',
                                           'ABCDEFGHIJKLMNOPQRSTUVWXYZ'),
                                 substring(./tbd:long, 2))"/>
              </xsl:element>
            </xsl:element>
          </xsl:if>
        </xsl:for-each>
        <tr><td pos="other">Other parts of speech</td></tr>
      </tbody>
      <br/>
      <tbody>
        <tr><td>LABEL on arc = dependency relation</td></tr>
        <tr><td>[0], [1], etc. = implied (elided) words</td></tr>
      </tbody>
    </table>
  </xsl:template>

</xsl:stylesheet>
