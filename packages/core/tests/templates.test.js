import { describe, it, expect } from 'vitest';
import { defaultTemplates, getTemplate, listTemplates } from '../src/templates.js';

describe('Templates', () => {
  describe('defaultTemplates', () => {
    it('should have owl-ontology template', () => {
      expect(defaultTemplates['owl-ontology']).toBeDefined();
      expect(defaultTemplates['owl-ontology'].name).toBe('OWL Ontology');
    });

    it('should have arrows template', () => {
      expect(defaultTemplates['arrows']).toBeDefined();
      expect(defaultTemplates['arrows'].name).toBe('Arrows');
    });

    it('should have blank template', () => {
      expect(defaultTemplates['blank']).toBeDefined();
      expect(defaultTemplates['blank'].name).toBe('Blank');
    });

    it('owl-ontology should have proper styling', () => {
      const template = defaultTemplates['owl-ontology'];
      expect(template.style.length).toBeGreaterThan(0);
      
      // Check for owl:Class styling
      const owlClassStyle = template.style.find(
        s => s.selector.includes('owl:Class')
      );
      expect(owlClassStyle).toBeDefined();
    });
  });

  describe('getTemplate', () => {
    it('should return template by name', () => {
      const template = getTemplate('arrows');
      expect(template.name).toBe('Arrows');
    });

    it('should return blank template for unknown name', () => {
      const template = getTemplate('nonexistent');
      expect(template.name).toBe('Blank');
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

    it('should include name and description', () => {
      const templates = listTemplates();
      templates.forEach(template => {
        expect(template.id).toBeDefined();
        expect(template.name).toBeDefined();
        expect(template.description).toBeDefined();
      });
    });
  });
});
