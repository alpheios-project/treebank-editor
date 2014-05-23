<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
    xmlns:tei="http://www.tei-c.org/ns/1.0"
    version="1.0">
    
    <xsl:param name="e_lang" select="'lat'"/>
    <xsl:param name="e_format" select="'aldt'"/>
    <xsl:param name="e_cite" select="'section'"/>
    <xsl:param name="e_encmarker" select="'-'"/>
    
    <xsl:output indent="yes"></xsl:output>
    <xsl:key name="segments" match="tei:w|tei:pc|w|pc" use="@s_n" />
    
    <xsl:template match="/">
        <xsl:element name="treebank">
            <xsl:attribute name="xml:lang">
                <xsl:choose>
                    <xsl:when test="//tei:text[@xml:lang]"><xsl:value-of select="//tei:text/@xml:lang"/></xsl:when>
                    <xsl:otherwise><xsl:value-of select="$e_lang"/></xsl:otherwise>
                </xsl:choose>
            </xsl:attribute>
            <xsl:attribute name="format"><xsl:value-of select="$e_format"/></xsl:attribute>
            <xsl:attribute name="version">1.5</xsl:attribute>
            <xsl:apply-templates/>
         
        </xsl:element>
    </xsl:template>
    
    <xsl:template match="llt-segtok">
        <xsl:message>XXX</xsl:message>
        <xsl:message><xsl:copy-of select="key('segments','1')"/></xsl:message>
        <!-- TODO we need the text inventory to calculate the paths -->
        <xsl:for-each select="//*[generate-id()=generate-id(key('segments',@s_n)[1])]">
            <xsl:variable name="num" select="@s_n"/>
            <xsl:element name="sentence">
                <xsl:attribute name="id"><xsl:value-of select="@s_n"/></xsl:attribute>
                <xsl:attribute name="document_id"></xsl:attribute>
                <xsl:attribute name="subdoc"></xsl:attribute>
                <xsl:attribute name="span"/>
                <xsl:apply-templates select="//*[@s_n=$num]"></xsl:apply-templates>
            </xsl:element>
            
        </xsl:for-each>
        
    </xsl:template>


    <xsl:template match="tei:w|w">

        <xsl:variable name="lang">
            <xsl:choose>
                <xsl:when test="//tei:text/@xml:lang"><xsl:value-of select="//tei:text/@xml:lang"/></xsl:when>
                <xsl:otherwise><xsl:value-of select="$e_lang"/></xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:element name="word">
            <xsl:attribute name="id"><xsl:value-of select="@n"></xsl:value-of></xsl:attribute>
            <xsl:attribute name="form"><xsl:value-of select="."/></xsl:attribute>
            <xsl:attribute name="lemma"/>
            <xsl:attribute name="postag"/>
            <xsl:attribute name="head">0</xsl:attribute>
            <xsl:attribute name="relation">nil</xsl:attribute>
        </xsl:element>
    </xsl:template>
    
    <xsl:template match="tei:pc|pc">
        <xsl:variable name="s" select="@s_n"/>
        <xsl:element name="word">
            <xsl:attribute name="id"><xsl:value-of select="@n"></xsl:value-of></xsl:attribute>
            <xsl:attribute name="form"><xsl:value-of select="."/></xsl:attribute>
            <xsl:attribute name="lemma">punc1</xsl:attribute>
            <xsl:attribute name="postag">u--------</xsl:attribute>
            <xsl:attribute name="head">0</xsl:attribute>
            <xsl:choose>
                <!-- RGorman says we always want AuxX for commas -->
                <xsl:when test=".=','">
                    <xsl:attribute name="relation">AuxX</xsl:attribute>
                </xsl:when>
                <!-- if punctuation is mid-sentence-->
                <xsl:when test="following-sibling::*[@s_n=$s]">
                    <xsl:attribute name="relation">AuxX</xsl:attribute>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:attribute name="relation">AuxK</xsl:attribute>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:element>
    </xsl:template>
    
    <xsl:template match="@*"/>

    <xsl:template match="*"/>
    
</xsl:stylesheet>