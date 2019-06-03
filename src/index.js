/**
 * General data munging functionality
 */

import * as d3 from 'd3';
import loadData from '@financial-times/load-data';

/**
 * Parses data file and returns structured data
 * @param  {String} url Path to CSV/TSV/JSON file
 * @return {Object}     Object containing series names, value extent and raw data object
 */
export const load = (url, options) => loadData(url).then(result => parse(result, options));

const parse = (
  result,
  options = {
    dateFormat: '%-d/%-m/%Y',
    yMin: null,
    joinPoints: true,
    highlightNames: null,
  },
) => {
  const data = result.data ? result.data : result;
  const {
    dateFormat, yMin, joinPoints, highlightNames,
  } = options; // eslint-disable-line no-unused-vars
  // make sure all the dates in the date column are a date object
  const parseDate = d3.timeParse(dateFormat);
  data.forEach((d) => {
    d.date = parseDate(d.date);
  });

  // Automatically calculate the seriesnames excluding the "marker" and "annotate column"
  const seriesNames = getSeriesNames(data.columns);
  // Use the seriesNames array to calculate the minimum and max values in the dataset
  const valueExtent = extentMulti(data, seriesNames, yMin);

  const isLineHighlighted = el => highlightNames.some(d => d === el);

  // Format the dataset that is used to draw the lines
  let highlightLines = {};
  let plotData = seriesNames.map(d => ({
    name: d,
    lineData: getlines(data, d),
    highlightLine: isLineHighlighted(d),
  }));

  highlightLines = plotData.filter(d => d.highlightLine === true);
  plotData = plotData.filter(d => d.highlightLine === false);

  // create an array of annotations
  const annotations = data
    .filter(d => d.annotate != '' && d.annotate !== undefined)
    .map(el => ({
      title: el.annotate,
      // note: '',
      targetX: el.date,
      targetY: el[plotData[0].name],
      radius: 0,
      type: getType(el.type),
    }));

  function getType(type) {
    if (type !== '') {
      return type;
    }
    return 'vertical';
  }

  // Format the data that is used to draw highlight tonal bands
  const boundaries = data.filter(d => d.highlight === 'begin' || d.highlight === 'end');
  const highlights = [];

  boundaries.forEach((d, i) => {
    if (d.highlight === 'begin') {
      highlights.push({ begin: d.date, end: boundaries[i + 1].date });
    }
  });

  return {
    seriesNames,
    data,
    plotData,
    highlightLines,
    valueExtent,
    highlights,
    annotations,
  };
};

/**
 * Returns the columns headers from the top of the dataset, excluding specified
 * @param  {Array<String>} columns Array of columns
 * @return {Array<String>}         Array of filtered columns
 */
export const getSeriesNames = (columns) => {
  const exclude = ['date', 'annotate', 'highlight', 'type'];
  return columns.filter(d => exclude.indexOf(d) === -1);
};

/**
 * Calculates the extent of multiple columns
 * @param  {Array<Object} d       An array of data points
 * @param  {Array<String>} columns An array of columns to group by
 * @param  {Number} yMin    Optional minimum Y value
 * @return {Array<Number>}  Extent of the set
 */
export function extentMulti(d, columns, yMin) {
  const ext = d.reduce((acc, row) => {
    const values = columns
      .map(key => row[key])
      .map((item) => {
        if (item !== 0 && (!item || item === '*')) {
          return yMin;
        }
        return Number(item);
      });
    const rowExtent = d3.extent(values);
    if (!acc.max) {
      acc.max = rowExtent[1];
      acc.min = rowExtent[0];
    } else {
      acc.max = Math.max(acc.max, rowExtent[1]);
      acc.min = Math.min(acc.min, rowExtent[0]);
    }
    return acc;
  }, {});
  return [ext.min, ext.max];
}

/**
 * Sorts the column information in the dataset into groups according to the column
 * head, so that the line path can be passed as one object to the drawing function
 *
 * @param {Array<Object>} d An array of data points
 * @param {String} group A group name
 */
export const getlines = (d, group) => d.map((el) => {
  const column = {
    name: group,
    date: el.date,
    value: +el[group],
    highlight: el.highlight,
    annotate: el.annotate,
  };
  if (el[group]) {
    return column;
  }

  if (el[group] === false && el.joinPoints === false) {
    return null;
  }
});
