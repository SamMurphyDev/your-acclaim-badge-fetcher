import axios from 'axios';
import { Badge, fetchBadges, baseUrl, PartialBadge, BadgeFull } from '..';
import { render } from 'mustache';
import { readFileSync } from 'fs';

jest.mock('axios');

let resolvableValue = '';
const mustacheCache: Record<string, string> = {};

const mockableFunction: (
  url: string,
  options: { responseType: 'text' }
) => Promise<{ data: string }> = () =>
  Promise.resolve({ data: resolvableValue });

const loadMustacheTemplate = async (fileName: string) =>
  (mustacheCache[fileName] ??= readFileSync(
    // @ts-ignore
    `${jasmine.testPath.substring(
      0,
      // @ts-ignore
      jasmine.testPath.lastIndexOf('/')
    )}/fixtures/${fileName}.mustache`
  ).toString('utf-8'));

const badgeListPage = async (context: ReadonlyArray<Badge>) =>
  render(await loadMustacheTemplate('BadgeList'), { badges: context });

const badgeViewPage = async (context: PartialBadge) =>
  render(await loadMustacheTemplate('BadgeView'), context);

describe('Scraping of Your Acclaims badge data', () => {
  beforeEach(() => {
    // @ts-ignore
    axios.get.mockImplementation(mockableFunction);
  });

  it('should successfully fetch minimal metadata if explicitly set to false', async () => {
    const context = [
      {
        title: 'badge-1',
        images: { 110: 'badge-1-img' },
        url: '/badge-1-href',
        organisation: 'badge-1-organisation',
      },
    ];

    expect.assertions(context.length * Object.keys(context[0]).length);
    resolvableValue = await badgeListPage(context);
    const result = await fetchBadges('', false);

    result.forEach(({ images, organisation, title, url }: Badge, index) => {
      expect(images[110]).toEqual(context[index].images[110]);
      expect(organisation).toEqual(context[index].organisation);
      expect(title).toEqual(context[index].title);
      expect(url).toEqual(`${baseUrl}${context[index].url}`);
    });
  });

  it('should fallback to no metadata if not explicitly set', async () => {
    const context = [
      {
        title: 'badge-1',
        images: { 110: 'badge-1-img' },
        url: '/badge-1-href',
        organisation: 'badge-1-organisation',
      },
    ];

    resolvableValue = await badgeListPage(context);
    const result = await fetchBadges('');

    expect(result.length).toBe(1);
    expect(Object.keys(result[0])).toEqual(
      expect.arrayContaining(Object.keys(context[0]))
    );
    expect(Object.keys(result[0]).length).toBe(Object.keys(context[0]).length);
  });

  it('should have an undefined image if no image is present', async () => {
    const context = [
      {
        title: 'badge-1',
        images: { 110: undefined },
        url: '/badge-1-href',
        organisation: 'badge-1-organisation',
      },
    ];

    resolvableValue = await badgeListPage(context);
    const result = await fetchBadges('');

    expect(result[0].images[110]).toBeUndefined();
  });

  it('should have an undefined title if no title is present', async () => {
    const context = [
      {
        title: undefined,
        images: { 110: undefined },
        url: '/badge-1-href',
        organisation: 'badge-1-organisation',
      },
    ];

    resolvableValue = await badgeListPage(context);
    const result = await fetchBadges('');

    expect(result[0].title).toBeUndefined();
  });

  it('should fetch additional metadata if explicitly set to true', async () => {
    const badgeContext: Record<string, PartialBadge> = {
      [`${baseUrl}/badge-1-href`]: {
        images: { 340: 'badge-page-img-1' },
        organisationUrl: 'organisation-url-1',
        skills: [{ name: 'Skill 1', url: 'skill-1-url' }],
      },
      [`${baseUrl}/badge-2-href`]: {
        images: { 340: 'badge-page-img-2' },
        organisationUrl: 'organisation-url-2',
        skills: [
          { name: 'Skill 2', url: 'skill-2-url' },
          { name: 'Skill 3', url: 'skill-3-url' },
        ],
      },
    };

    const listContext = [
      {
        title: 'badge-1',
        images: { 110: 'badge-1-img' },
        url: '/badge-1-href',
        organisation: 'badge-1-organisation',
      },
      {
        title: 'badge-2',
        images: { 110: 'badge-2-img' },
        url: '/badge-2-href',
        organisation: 'badge-2-organisation',
      },
    ];

    const getMock: typeof mockableFunction = async (url) => ({
      data:
        url === `${baseUrl}/users//badges`
          ? await badgeListPage(listContext)
          : await badgeViewPage(badgeContext[url]),
    });

    // @ts-ignore
    axios.get.mockImplementation(getMock);

    expect.assertions(
      listContext.length *
        (Object.keys(listContext[0]).length +
          Object.keys(Object.entries(badgeContext)[0][1]).length) +
        Object.entries(badgeContext)
          .filter((value) => value[1].skills.length > 1)
          .reduce((acc, value) => acc + value[1].skills.length, -1)
    );

    const result = (await fetchBadges('', true)) as BadgeFull[];

    result.forEach(
      (
        {
          images,
          organisation,
          title,
          url,
          organisationUrl,
          skills,
        }: BadgeFull,
        index
      ) => {
        expect(images[110]).toEqual(listContext[index].images[110]);
        expect(organisation).toEqual(listContext[index].organisation);
        expect(title).toEqual(listContext[index].title);
        expect(url).toEqual(`${baseUrl}${listContext[index].url}`);

        const badge = badgeContext[`${baseUrl}${listContext[index].url}`];

        expect(organisationUrl).toEqual(`${baseUrl}${badge.organisationUrl}`);
        expect(images[340]).toEqual(badge.images[340]);
        skills.forEach((skill, index) => {
          expect(skill).toEqual({
            ...badge.skills[index],
            url: `${baseUrl}${badge.skills[index].url}`,
          });
        });
      }
    );
  });

  it('should have an undefined view image if no view image is present', async () => {
    const badgeContext: Record<string, PartialBadge> = {
      [`${baseUrl}/badge-1-href`]: {
        images: { 340: undefined },
        organisationUrl: 'organisation-url-1',
        skills: [{ name: 'Skill 1', url: 'skill-1-url' }],
      },
    };

    const listContext = [
      {
        title: 'badge-1',
        images: { 110: 'badge-1-img' },
        url: '/badge-1-href',
        organisation: 'badge-1-organisation',
      },
    ];

    const getMock: typeof mockableFunction = async (url) => ({
      data:
        url === `${baseUrl}/users//badges`
          ? await badgeListPage(listContext)
          : await badgeViewPage(badgeContext[url]),
    });

    // @ts-ignore
    axios.get.mockImplementation(getMock);

    expect.assertions(1);

    const [result] = (await fetchBadges('', true)) as BadgeFull[];

    expect(result.images[340]).toBeUndefined();
  });

  it('should have an undefined name for a skill if link name is not present', async () => {
    const badgeContext: Record<string, PartialBadge> = {
      [`${baseUrl}/badge-1-href`]: {
        images: { 340: 'badge-page-img-1' },
        organisationUrl: 'organisation-url-1',
        skills: [{ name: '', url: 'skill-1-url' }],
      },
    };

    const listContext = [
      {
        title: 'badge-1',
        images: { 110: 'badge-1-img' },
        url: '/badge-1-href',
        organisation: 'badge-1-organisation',
      },
    ];

    const getMock: typeof mockableFunction = async (url) => ({
      data:
        url === `${baseUrl}/users//badges`
          ? await badgeListPage(listContext)
          : await badgeViewPage(badgeContext[url]),
    });

    // @ts-ignore
    axios.get.mockImplementation(getMock);

    expect.assertions(1);

    const [result] = (await fetchBadges('', true)) as BadgeFull[];

    expect(result.skills[0].name).toEqual('');
  });

  it('should fetch partial badge info if badge page is invalid', async () => {
    const listContext = [
      {
        title: 'badge-1',
        images: { 110: 'badge-1-img' },
        url: '/badge-1-href',
        organisation: 'badge-1-organisation',
      },
    ];

    const getMock: typeof mockableFunction = async (url) => ({
      data:
        url === `${baseUrl}/users//badges`
          ? await badgeListPage(listContext)
          : '<html></html>',
    });

    // @ts-ignore
    axios.get.mockImplementation(getMock);

    expect.assertions(3);

    const [result] = (await fetchBadges('', true)) as BadgeFull[];

    expect(result.images['340']).toBeUndefined();
    expect(result.organisationUrl).toBeUndefined();
    expect(result.skills).toEqual([]);
  });
});
