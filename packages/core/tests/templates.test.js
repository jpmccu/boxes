import { describe, it, expect } from 'vitest';
import { defaultTemplates, getTemplate, listTemplates } from '../src/templates.js';

describe('Templates', () => {
  describe('defaultTemplates', () => {
    it('should have owl-ontology template', () => {
      expect(defaultTemplates['owl-ontology']).toBeDefined();
      expect(defaultTemplates['owl-ontology'].title).toBe('Ontology or RDF File');
    });

    it('should have arrows template', () => {
      expect(defaultTemplates['arrows']).toBeDefined();
      expect(defaultTemplates['arrows'].title).toBe('Arrows');
    });

    it('should have blank template', () => {
      expect(defaultTemplates['blank']).toBeDefined();
      expect(defaultTemplates['blank'].title).toBe('Blank');
    });

    it('each template should have palette with nodeTypes and edgeTypes', () => {
      for (const [key, t] of Object.entries(defaultTemplates)) {
        expect(t.palette, `${key} missing palette`).toBeDefined();
        expect(Array.isArray(t.palette.nodeTypes), `${key} missing palette.nodeTypes`).toBe(true);
        expect(Array.isArray(t.palette.edgeTypes), `${key} missing palette.edgeTypes`).toBe(true);
      }
    });

    it('each template should have userStylesheet array', () => {
      for (const [key, t] of Object.entries(defaultTemplates)) {
        expect(Array.isArray(t.userStylesheet), `${key} missing userStylesheet`).toBe(true);
      }
    });

    it('owl-ontology should have proper styling', () => {
      const template = defaultTemplates['owl-ontology'];
      expect(template.userStylesheet.length).toBeGreaterThan(0);

      const owlClassStyle = template.userStylesheet.find(
        s => s.selector.includes('owl:Class')
      );
      expect(owlClassStyle).toBeDefined();
    });
  });

  describe('getTemplate', () => {
    it('should return template by name', () => {
      const template = getTemplate('arrows');
      expect(template.title).toBe('Arrows');
    });

    it('should return blank template for unknown name', () => {
      const template = getTemplate('nonexistent');
      expect(template.title).toBe('Blank');
    });
  });

  describe('listTemplates', () => {
    it('should list all templates', () => {
      const templates = listTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(3);

      const ids = templates.map(t => t.id);
      expect(ids).toContain('owl-ontology');
      expect(ids).toContain('arrows');
      expect(ids).toContain('blank');
    });

    it('should include title and description', () => {
      const templates = listTemplates();
      templates.forEach(template => {
        expect(template.id).toBeDefined();
        expect(template.title).toBeDefined();
        expect(template.description).toBeDefined();
      });
    });
  });
});
