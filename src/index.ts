import axios from 'axios';
import deepmerge from 'deepmerge';
import { JSDOM } from 'jsdom';

export const baseUrl = 'https://www.youracclaim.com';

export interface Badge {
  title: string | undefined;
  url: string;
  images: {
    110: string | undefined;
  };
  organisation: string;
}

export interface BadgeFull extends Badge {
  images: Badge['images'] & {
    340: string | undefined;
  };
  organisationUrl: string;
  skills: ReadonlyArray<Skill>;
}

export type PartialBadge = Omit<BadgeFull, keyof Badge> & {
  images: Omit<BadgeFull['images'], 110>;
};

export interface Skill {
  name: string | undefined;
  url: string;
}

const classSelector = (
  element: HTMLElement,
  selector: keyof HTMLElementTagNameMap,
  className: string
) =>
  Array.from(element.querySelectorAll(selector)).filter((value) =>
    value.classList.contains(className)
  )[0];

const cleanText = (text?: string) => (text ? text.replace(/\n/g, '') : text);

const extractAdditionalInformation = (
  url: string,
  badge: HTMLHtmlElement
): PartialBadge => ({
  images: {
    '340':
      classSelector(badge, 'img', 'cr-badges-full-badge__img')?.getAttribute(
        'src'
      ) ?? undefined,
  },
  organisationUrl: `${url}${classSelector(
    badge,
    'div',
    'cr-badges-badge-issuer__entity'
  )
    ?.querySelector('a')
    ?.getAttribute('href')}`,
  skills: Array.from(badge.querySelectorAll('li'))
    .filter((value) =>
      value.classList.contains('cr-badges-badge-skills__skill--linked')
    )
    .map(
      (value): Skill => {
        const link = value.querySelector('a');
        return {
          name: cleanText(link?.innerHTML),
          url: `${baseUrl}${link?.getAttribute('href')}`,
        };
      }
    ),
});

// Change to use a function union with narrow types when they fix
// https://github.com/microsoft/TypeScript/issues/19360
type ExtractorBadge = (
  url: string,
  additionalMetaData: boolean
) => (badge: HTMLAnchorElement) => Promise<Badge | BadgeFull>;

const extractInformationFromBadge: ExtractorBadge = (
  url: string,
  additionalMetaData: boolean
) => async (badge: HTMLAnchorElement) =>
  deepmerge(
    {
      title: badge.getAttribute('title') ?? undefined,
      url: `${url}${badge.getAttribute('href')}`,
      images: {
        110: badge.querySelector('img')?.getAttribute('src') ?? undefined,
      },
      organisation: cleanText(
        classSelector(badge, 'div', 'cr-standard-grid-item-content__subtitle')
          ?.innerHTML
      ),
    },
    additionalMetaData
      ? extractAdditionalInformation(
          url,
          <HTMLHtmlElement>(
            new JSDOM(
              (await fetchPage(`${url}${badge.getAttribute('href')}`)).data
            ).window.document.querySelector('html')
          )
        )
      : {}
  );

const fetchPage = async (url: string) =>
  axios.get<string>(url, {
    responseType: 'text',
  });

/**
 * Fetches the badges for an Your Acclaim profile
 *
 * @param profileId "Your Acclaim" profile id
 * @param additionalMetaData True to fetch organisation url, badge description
 * and skills
 * @returns array of badges with metadata
 */
export const fetchBadges = async (
  profileId: string,
  additionalMetaData = false
): Promise<Array<Badge | BadgeFull>> => {
  const badgesUrl = `${baseUrl}/users/${profileId}/badges`;

  const dom = new JSDOM((await fetchPage(badgesUrl)).data);

  return Promise.all(
    Array.from(dom.window.document.querySelectorAll('a'))
      .filter((value) =>
        value.classList.contains('cr-public-earned-badge-grid-item')
      )
      .map(await extractInformationFromBadge(baseUrl, additionalMetaData))
  );
};
