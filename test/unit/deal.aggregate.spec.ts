import { Deal } from '@modules/deals/domain/deal.aggregate';

function makeDeal() {
  return Deal.create({ externalRef: 'PANEL-1', name: 'Project Fujitsu', governingLaw: 'Netherlands' }).getValue();
}

describe('Deal aggregate', () => {
  it('updates the name and trims it', () => {
    const deal = makeDeal();
    const result = deal.updateDetails({ name: '  Project Meridian  ' });
    expect(result.isSuccess).toBe(true);
    expect(deal.name).toBe('Project Meridian');
    expect(deal.governingLaw).toBe('Netherlands'); // unchanged
  });

  it('rejects an empty name', () => {
    const deal = makeDeal();
    const result = deal.updateDetails({ name: '   ' });
    expect(result.isFailure).toBe(true);
    expect(deal.name).toBe('Project Fujitsu'); // unchanged
  });

  it('updates governing law independently of name', () => {
    const deal = makeDeal();
    deal.updateDetails({ governingLaw: 'Germany' });
    expect(deal.governingLaw).toBe('Germany');
    expect(deal.name).toBe('Project Fujitsu');
  });

  it('clears governing law when explicitly set to null', () => {
    const deal = makeDeal();
    deal.updateDetails({ governingLaw: null });
    expect(deal.governingLaw).toBeNull();
  });

  it('is a no-op when neither field is provided', () => {
    const deal = makeDeal();
    const result = deal.updateDetails({});
    expect(result.isSuccess).toBe(true);
    expect(deal.name).toBe('Project Fujitsu');
    expect(deal.governingLaw).toBe('Netherlands');
  });
});
