/**
 * Template configurations for common graph types
 */

export const defaultTemplates = {
  'owl-ontology': {
    name: 'Ontology',
    description: 'Template with OWL and SKOS meta-types styling (CMap Ontology edition)',
    context: {
      'owl': 'http://www.w3.org/2002/07/owl#',
      'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
      'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      'skos': 'http://www.w3.org/2004/02/skos/core#',
      'sh': 'http://www.w3.org/ns/shacl#',
      // Term definitions: properties whose values are IRI references, not literals.
      // These enable JSON-LD @type coercion so that plain string values like
      // "owl:Thing" are expanded to full IRIs rather than treated as string literals.
      'rdfs:subClassOf':          { '@type': '@id' },
      'rdfs:domain':              { '@type': '@id' },
      'rdfs:range':               { '@type': '@id' },
      'rdfs:subPropertyOf':       { '@type': '@id' },
      'rdfs:seeAlso':             { '@type': '@id' },
      'rdfs:isDefinedBy':         { '@type': '@id' },
      'owl:equivalentClass':      { '@type': '@id' },
      'owl:equivalentProperty':   { '@type': '@id' },
      'owl:inverseOf':            { '@type': '@id' },
      'owl:onProperty':           { '@type': '@id' },
      'owl:allValuesFrom':        { '@type': '@id' },
      'owl:someValuesFrom':       { '@type': '@id' },
      'owl:imports':              { '@type': '@id' },
      'skos:broader':             { '@type': '@id' },
      'skos:narrower':            { '@type': '@id' },
      'skos:related':             { '@type': '@id' },
      'skos:broadMatch':          { '@type': '@id' },
      'skos:narrowMatch':         { '@type': '@id' },
      'skos:exactMatch':          { '@type': '@id' },
      'skos:closeMatch':          { '@type': '@id' },
      'sh:path':                  { '@type': '@id' },
      'sh:node':                  { '@type': '@id' },
      'sh:qualifiedValueShape':   { '@type': '@id' },
      'sh:property':              { '@type': '@id' },
      'sh:class':                 { '@type': '@id' },
      'sh:datatype':              { '@type': '@id' },
    },
    nodeTypes: [
      { id: 'owl:Class',      label: 'Class',        data: { '@type': 'owl:Class','@id':'', 'skos:definition':'' },        color: '#E6F3FF', borderColor: '#2471A3', shape: 'roundrectangle' },
      { id: 'default',        label: 'Instance',     data: {'@type':'', '@id':''},               color: '#FFFFFF', borderColor: '#666666', shape: 'ellipse' },
      { id: 'skos:Concept',   label: 'Concept',        data: { '@type': 'skos:Concept','@id':'', 'skos:definition':'' },        color: '#E6F3FF', borderColor: '#2471A3', shape: 'roundrectangle' },
      { id: 'owl:Ontology',   label: 'Ontology',     data: { '@type': 'owl:Ontology', '@id':''},     color: '#FFFACD', borderColor: '#B8860B', shape: 'roundrectangle' },
    ],
    edgeTypes: [
      { id: 'rdfs:subClassOf',        label: 'are',     data: { '@id': 'rdfs:subClassOf' },       color: '#555555', lineStyle: 'solid' },
      { id: 'rdf:type',               label: 'a',       data: { '@id': 'rdf:type' },              color: '#8E44AD', lineStyle: 'solid' },
      { id: 'skos:related',                label: 'related',        data: {'@id':'skos:related'},                         color: '#666666', lineStyle: 'solid' },
      { id: 'skos:broader',                label: 'broader',        data: {'@id':'skos:broader'},                         color: '#777777', lineStyle: 'solid' },
      { id: 'skos:narrower',                label: 'narrower',        data: {'@id':'skos:narrower'},                         color: '#777777', lineStyle: 'solid' },
      { 
        id: 'owl:ObjectProperty',
        label: 'ObjectProperty',
        data: { '@type': 'owl:ObjectProperty' },
        color: '#2471A3',
        lineStyle: 'dashed',
        // Reified property mapping
        source_property: 'rdfs:domain',
        target_property: 'rdfs:range',
      },
      { 
        id: 'owl:DatatypeProperty',
        label: 'DatatypeProperty',
        data: { '@type': 'owl:DatatypeProperty' },
        color: '#1E8449',
        lineStyle: 'solid',
        // Reified property mapping
        source_property: 'rdfs:domain',
        target_property: 'rdfs:range',
      },
      {
        id: 'QualifiedPropertyShape',
        label: 'Qualified Property Shape',
        data: { 
          '@type': 'sh:PropertyShape',
          'sh:path': '', // This would be the property being qualified
          'sh:qualifiedMinCount': 0, // Default cardinality
        },
        color: '#2471A3',
        lineStyle: 'dashed',
        // Reified property mapping for SHACL Qualified property shapes
        target_property: 'sh:qualifiedValueShape',
        reverse_source_property: 'sh:property' // This indicates that the source node is connected via sh:property to the QualifiedPropertyShape
      },
      {
        id: 'PropertyShape',
        label: 'Property Shape',
        data: { 
          '@type': 'sh:PropertyShape',
          'sh:path': '', // This would be the property being qualified
        },
        color: '#2471A3',
        lineStyle: 'dashed',
        // Reified property mapping for SHACL Qualified property shapes
        target_property: 'sh:node',
        reverse_source_property: 'sh:property' // This indicates that the source node is connected via sh:property to the QualifiedPropertyShape
      },
    ],
    elements: {
      nodes: [],
      edges: []
    },
    style: [
      // Default node - plain concept box
      {
        selector: 'node',
        style: {
          'shape': 'ellipse',
          'background-color': '#FFFFFF',
          'border-width': 2,
          'border-color': '#666666',
          'width': 'label',
          'height': 'label',
          'padding': '8px',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '13px',
          'color': '#000000',
          'min-width': '60px'
        }
      },
      // owl:Ontology - yellow box (CMap Ontology style)
      {
        selector: 'node[\\@type = "owl:Ontology"]',
        style: {
          'shape': 'roundrectangle',
          'background-color': '#FFFACD',
          'border-width': 1,
          'border-color': '#B8860B',
          'font-weight': 'bold',
          'color': '#000000'
        }
      },
      // owl:Class - blue rounded box
      {
        selector: 'node[\\@type = "owl:Class"]',
        style: {
          'shape': 'roundrectangle',
          'background-color': '#E6F3FF',
          'border-width': 1,
          'border-color': '#2471A3',
          'font-size': '14px',
          'font-weight': 'bold',
          'color': '#154360'
        }
      },
      // rdfs:Class
      {
        selector: 'node[\\@type = "rdfs:Class"]',
        style: {
          'shape': 'roundrectangle',
          'background-color': '#E6F3FF',
          'border-width': 1,
          'border-color': '#2471A3',
          'font-size': '14px',
          'font-weight': 'bold',
          'color': '#154360'
        }
      },
      // Default edge
      {
        selector: 'edge',
        style: {
          'label': 'data(label)',
          'line-color': '#666666',
          'target-arrow-color': '#666666',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'font-size': '11px',
          'text-background-color': '#FFFFFF',
          'text-background-opacity': 0.8,
          'text-background-padding': '2px',
          'width': 1.5
        }
      },
      // owl:ObjectProperty edge
      {
        selector: 'edge[\\@type = "owl:ObjectProperty"]',
        style: {
          'line-color': '#2471A3',
          'target-arrow-color': '#2471A3',
          'width': 2
        }
      },
      // owl:DatatypeProperty edge - dashed
      {
        selector: 'edge[\\@type = "owl:DatatypeProperty"]',
        style: {
          'line-color': '#1E8449',
          'target-arrow-color': '#1E8449',
          'line-style': 'dashed',
          'width': 1.5
        }
      },
      // rdfs:subClassOf - hollow triangle arrow (inheritance)
      {
        selector: 'edge[\\@id = "rdfs:subClassOf"]',
        style: {
          'line-color': '#555555',
          'target-arrow-color': '#555555',
          'target-arrow-shape': 'triangle',
          'width': 2
        }
      },
      // rdf:type edge
      {
        selector: 'edge[\\@id = "rdf:type"]',
        style: {
          'line-color': '#884EA0',
          'target-arrow-color': '#884EA0',
          'line-style': 'dotted',
          'width': 1.5
        }
      }
    ]
  },

  'arrows': {
    name: 'Arrows',
    description: 'Basic graph template similar to Arrows (Neo4j)',
    nodeTypes: [
      { id: 'default', label: 'Node', data: {}, color: '#6FB1FC', borderColor: '#3A7CC5', shape: 'ellipse' }
    ],
    edgeTypes: [
      { id: 'default', label: 'RELATES_TO', data: {}, color: '#6FB1FC', lineStyle: 'solid' }
    ],
    elements: {
      nodes: [],
      edges: []
    },
    style: [
      {
        selector: 'node',
        style: {
          'background-color': '#6FB1FC',
          'shape': 'ellipse',
          'width': '80px',
          'height': '80px',
          'border-width': 3,
          'border-color': '#3A7CC5',
          'color': '#000000',
          'font-size': '13px',
          'text-valign': 'center',
          'text-halign': 'center'
        }
      },
      {
        selector: 'edge',
        style: {
          'label': 'data(label)',
          'line-color': '#9DB8D2',
          'target-arrow-color': '#9DB8D2',
          'target-arrow-shape': 'triangle',
          'width': 2,
          'curve-style': 'bezier',
          'font-size': '11px',
          'text-background-color': '#FFFFFF',
          'text-background-opacity': 0.8,
          'text-background-padding': '2px'
        }
      }
    ]
  },

  'blank': {
    name: 'Blank',
    description: 'Empty graph with default styling',
    nodeTypes: [
      { id: 'default', label: 'Node', data: {}, color: '#CCCCCC', borderColor: '#888888', shape: 'rectangle' }
    ],
    edgeTypes: [
      { id: 'default', label: 'edge', data: {}, color: '#666666', lineStyle: 'solid' }
    ],
    elements: {
      nodes: [],
      edges: []
    },
    style: []
  }
};

/**
 * Get a template by name
 */
export function getTemplate(name) {
  return defaultTemplates[name] || defaultTemplates['blank'];
}

/**
 * List all available templates
 */
export function listTemplates() {
  return Object.keys(defaultTemplates).map(key => ({
    id: key,
    name: defaultTemplates[key].name,
    description: defaultTemplates[key].description
  }));
}
