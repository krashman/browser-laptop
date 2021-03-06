/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const Immutable = require('immutable')
const UrlUtil = require('../../../js/lib/urlutil')
const {makeImmutable} = require('../state/immutableUtil')

const getSitesBySubkey = (sites, siteKey) => {
  if (!sites || !siteKey) {
    return makeImmutable([])
  }
  const splitKey = siteKey.split('|', 2)
  const partialKey = splitKey.join('|')
  const matches = sites.filter((site, key) => {
    return key.indexOf(partialKey) > -1
  })
  return matches.toList()
}

const getDetailsFromTab = (sites, tab) => {
  let location = tab.get('url')
  const partitionNumber = tab.get('partitionNumber', 0)
  let parentFolderId

  // TODO check if needed https://github.com/brave/browser-laptop/pull/8588
  // we need to find which sites should be send in, I am guessing bookmarks

  // if site map is available, look up extra information:
  // - original url (if redirected)
  // - parent folder id
  if (sites) {
    // get all sites matching URL and partition (disregarding parentFolderId)
    let siteKey = getKey(makeImmutable({location, partitionNumber}))
    let results = getSitesBySubkey(sites, siteKey)

    // only check for provisional location if entry is not found
    if (results.size === 0) {
      // if provisional location is different, grab any results which have that URL
      // this may be different if the site was redirected
      const provisionalLocation = tab.getIn(['frame', 'provisionalLocation'])
      if (provisionalLocation && provisionalLocation !== location) {
        siteKey = getKey(makeImmutable({
          location: provisionalLocation,
          partitionNumber
        }))
        results = results.merge(getSitesBySubkey(sites, siteKey))
      }
    }

    // update details which get returned below
    if (results.size > 0) {
      location = results.getIn([0, 'location'])
      parentFolderId = results.getIn([0, 'parentFolderId'])
    }
  }

  const siteDetail = {
    location: location,
    title: tab.get('title')
  }

  if (partitionNumber != null) {
    siteDetail.partitionNumber = partitionNumber
  }

  if (parentFolderId) {
    siteDetail.parentFolderId = parentFolderId
  }

  return makeImmutable(siteDetail)
}

const getDetailFromProperties = (createProperties) => {
  const siteDetail = {
    location: createProperties.get('url')
  }

  if (createProperties.get('partitionNumber') !== undefined) {
    siteDetail.partitionNumber = createProperties.get('partitionNumber')
  }
  return makeImmutable(siteDetail)
}

const getDetailFromFrame = (frame) => {
  const pinnedLocation = frame.get('pinnedLocation')
  let location = frame.get('location')
  if (pinnedLocation !== 'about:blank') {
    location = pinnedLocation
  }

  return makeImmutable({
    location,
    title: frame.get('title'),
    partitionNumber: frame.get('partitionNumber'),
    favicon: frame.get('icon'),
    themeColor: frame.get('themeColor') || frame.get('computedThemeColor')
  })
}

const getPinnedSiteProps = site => {
  return Immutable.fromJS({
    location: site.get('location'),
    order: site.get('order'),
    partitionNumber: site.get('partitionNumber', 0)
  })
}

const getKey = (siteDetail) => {
  if (!siteDetail) {
    return null
  }

  let location = siteDetail.get('location')

  if (location) {
    location = UrlUtil.getLocationIfPDF(location)
    return location + '|' +
      (siteDetail.get('partitionNumber') || 0)
  }
  return null
}

module.exports = {
  getDetailsFromTab,
  getDetailFromProperties,
  getDetailFromFrame,
  getPinnedSiteProps,
  getKey
}
