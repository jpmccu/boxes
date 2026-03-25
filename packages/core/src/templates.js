/**
 * Template configurations for common graph types.
 * Templates are stored as JSON files and re-exported here.
 */

import blankTemplate from './templates/blank.json';
import arrowsTemplate from './templates/arrows.json';
import owlOntologyTemplate from './templates/owl-ontology.json';

export const defaultTemplates = {
  'blank': blankTemplate,
  'arrows': arrowsTemplate,
  'owl-ontology': owlOntologyTemplate,
};

/**
 * Get a template by name
 */
export function getTemplate(name) {
  return defaultTemplates[name] || defaultTemplates['blank'];
}

/**
 * Fetch a template JSON file from a URL and return the parsed object.
 * @param {string} url
 * @returns {Promise<object>}
 */
export async function loadTemplateFromUrl(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} loading template: ${url}`);
  return response.json();
}

/**
 * List all available templates
 */
export function listTemplates() {
  return Object.keys(defaultTemplates).map(key => ({
    id: key,
    title: defaultTemplates[key].title,
    description: defaultTemplates[key].description,
  }));
}
