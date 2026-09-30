import { hubUrl } from './realtime.service';

describe('hubUrl', () => {
  it('puts the live channel beside the API, not under /api', () => {
    expect(hubUrl('http://localhost:4401/api')).toBe('http://localhost:4401/hubs/notifications');
    expect(hubUrl('https://api.school.example/api/')).toBe('https://api.school.example/hubs/notifications');
  });
});
