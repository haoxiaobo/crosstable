/**
 * 生成一个交叉表对象，用于对数据进行分组和统计
 * @param {Array} objs - 包含数据对象的数组
 * @param {Array} lineGrpProps - 定义行分组的属性数组
 * @param {Array} colGrpProps - 定义列分组的属性数组
 * @param {staticItem[]} statisticProps - 定义统计字段的属性数组
 * @param {String} staticItem.prop - 要统计的属性名
 * @param {String} staticItem.showname - 要显示的属性名
 * @param {string|function} staticItem.method - 统计方法，可选值为'sum', 'count', 'avg', 'count2', 'avg2', function(){}
 * @param {Object} options - 其他可选参数
 * @param {Boolean} options.keepDetail - 是否保留详细数据，默认为 true
 * @returns {Object} 包含所有分组信息和统计信息的交叉表对象
 * @property {String} k - 键，用于标识分组键
 * @property {String} v - 值，用于标识分组值
 * @property {Object} indexmap - 存储当前级别的子分组信息
 * @property {Array} reldatas - 存储当前分组下的相关数据对象
 * @property {Array} subs - 存储子分组信息
 * @property {Array} sts - 存储统计信息
 * @property {Array} linkPath - 存储当前分组的路径信息，用于回溯
 * @property {Object} parent - 存储父分组对象的引用
 * @property {Array} lineGrpProps - 存储行分组的属性名
 * @property {Array} colGrpProps - 存储列分组的属性名
 * @property {Array} statisticProps - 存储统计字段的显示名
 */

function CrossTable(objs, lineGrpProps, colGrpProps, statisticProps, options) {


    if (!lineGrpProps) lineGrpProps = [];
    if (!colGrpProps) colGrpProps = [];
    if (!statisticProps) statisticProps = [];

    // 顶层node
    var result = {
        k: '', v: '', indexmap: {},
        reldatas: [], subs: [],
        sts: [],
        linkPath: [],
        parent: null
    };

    var allGrpProps = lineGrpProps.concat(colGrpProps);

    for (var i = 0; i < objs.length; i++) {
        var obj = objs[i];
        var curResultLevel = result; //当前层次

        curResultLevel.reldatas.push(obj);
        preSt(curResultLevel, obj, statisticProps);

        for (var j = 0; j < allGrpProps.length; j++) {
            var k = allGrpProps[j];
            var v = obj[k];
            if (!curResultLevel.indexmap.hasOwnProperty(v)) {
                var grpnode = {
                    k: k,
                    v: v,
                    indexmap: {},
                    reldatas: [],
                    subs: [],
                    sts: [],
                    linkPath: [...curResultLevel.linkPath, { k: k, v: v }],
                    parent: curResultLevel
                };
                curResultLevel.indexmap[v] = grpnode;
                curResultLevel.subs.push(grpnode);
            }

            curResultLevel = curResultLevel.indexmap[v];
            curResultLevel.reldatas.push(obj);
            preSt(curResultLevel, obj, statisticProps);
        }
    }

    calcResult(result, statisticProps);

    if (!options || !options.keepDetail)
        clearResult(result);

    result.lineGrpProps = lineGrpProps;
    result.colGrpProps = colGrpProps;
    result.statisticProps = statisticProps.map(x => {
        return x.showname;
    });

    return result;
}

/**
 * 渲染交叉表
 *
 * @param {object} crosstable - 要渲染的交叉表对象
 * @param {string} holderID - 要附加表格的容器元素的 ID
 * @param {object} options - 渲染选项
 * @param {string} [options.className] - 表格的 CSS 类名
 * @param {string[]} [options.orderBy] - 定义排序顺序的属性数组
 * @param {boolean} [options.hideSum] - 是否隐藏小计行
 * @param {string[]} [options.showSumProps] - 指定要显示小计的属性
 * @param {object[]} [options.extCols] - 额外的列定义
 */
function RenderCrossTable(crosstable, holderID, options) {
    var divHolder = document.getElementById(holderID);
    if (!divHolder)
        return;
    var tab = document.createElement('table');
    divHolder.appendChild(tab);
    tab.className = options.className;

    tab.className = options.className;
    var tr = document.createElement('tr');
    tab.appendChild(tr);

    var allGrpProps = [...crosstable.lineGrpProps.concat(crosstable.colGrpProps)];

    for (var i = 0; i < allGrpProps.length; i++) {
        var th = document.createElement('th');
        th.innerText = allGrpProps[i];
        tr.appendChild(th);
    }

    for (var i = 0; i < crosstable.statisticProps.length; i++) {
        var th = document.createElement('th');
        th.innerText = crosstable.statisticProps[i];
        tr.appendChild(th);
    }
    if (options.extCols) {
        for (var i = 0; i < options.extCols.length; i++) {
            var th = document.createElement('th');
            th.innerText = options.extCols[i].header;
            tr.appendChild(th)
        }
    }

    tr = document.createElement('tr');
    tab.appendChild(tr);

    RenderCrossLineGrpNode(crosstable, tab, tr, 0, options);

    /**
     * 渲染一个交叉表中的行组
     *
     * @param {object} grpNode - 要渲染的行组对象
     * @param {HTMLTableElement} tab - 要附加新行的表格对象
     * @param {HTMLTableRowElement} tr - 当前行对象，通常为新创建的行
     * @param {number} level - 当前组的级别，用于计算 rowspan
     * @param {object} options - 可选参数
     * @param {string[]} [options.orderBy] - 定义排序顺序的属性数组
     * @param {boolean} [options.hideSum] - 是否隐藏小计行
     * @param {string[]} [options.showSumProps] - 指定要显示小计的属性
     * @param {object[]} [options.extCols] - 额外的列定义
     * @returns {object} 包含 maxLevel 和 maxGrpCount 属性的对象
     */
    function RenderCrossLineGrpNode(grpNode, tab, tr, level, options) {
        // 计算本级grp的maxLevel和maxGrpCount(包括本级)
        var maxLevel = 0;
        var maxGrpCount = 0;
        var gtd;

        // 处理排序
        if (options.orderBy) {
            var subs = grpNode.subs.sort((a, b) => {
                // 按指定的列顺序一一试排
                for (var j = 0; j < options.orderBy.length; j++) {
                    var orderItem = options.orderBy[j];
                    var sortDirection = (orderItem.sortDirection == 'desc') ? -1 : 1;

                    if (a.k == orderItem.prop) {
                        if (a.v != b.v) {
                            return a.v > b.v ? sortDirection : -sortDirection;
                        }
                    }
                    if (a.sts.hasOwnProperty(orderItem.prop)) {
                        if (a.sts[orderItem.prop] != b.sts[orderItem.prop])
                            return a.sts[orderItem.prop] > b.sts[orderItem.prop] ? sortDirection : -sortDirection;
                    }
                }
                return 0;
            });
        } else {
            var subs = grpNode.subs;
        }

        if (level != 0) {
            // 填充本级grp的值
            var gtd = document.createElement('td');
            gtd.innerText = grpNode.v;
            tr.appendChild(gtd);
            gtd.className = 'grp-cell';
        }
        // 递归子级
        for (var i = 0; i < subs.length; i++) {
            var subGrpNode = grpNode.subs[i];
            if (i != 0) {
                tr = document.createElement('tr');
                tab.appendChild(tr);
            }
            var subResult = RenderCrossLineGrpNode(subGrpNode, tab, tr, level + 1, options);

            // 合并子级的maxLevel和maxGrpCount
            maxLevel = Math.max(maxLevel, subResult.maxLevel);
            maxGrpCount += subResult.maxGrpCount;
        }

        // 统计值


        // 如果是终层
        if (grpNode.subs.length == 0) {
            for (var i = 0; i < crosstable.statisticProps.length; i++) {
                var td = document.createElement('td');
                td.innerText = grpNode.sts[crosstable.statisticProps[i]];

                td.className = 'sts-cell';
                tr.appendChild(td);
            }
            if (options.extCols) {
                for (var i = 0; i < options.extCols.length; i++) {
                    var td = document.createElement('td');
                    td.innerHTML = options.extCols[i].htmlContent(grpNode);
                    tr.appendChild(td)
                }
            }
            maxGrpCount++;
        }

        // 小计
        if (grpNode.subs.length != 0 && !options.hideSum
            || (grpNode.subs.length != 0 && options.showSumProps && options.showSumProps.includes(grpNode.k))) {
            // 小计前先填充空格
            tr = document.createElement('tr');
            tab.appendChild(tr);
            tr.className = 'total-row';
            var etd = document.createElement('td');
            etd.innerText = grpNode.k == '' ? '总计' : '小计';
            etd.className = 'grp-cell';

            tr.appendChild(etd);

            for (var i = 0; i < crosstable.statisticProps.length; i++) {
                var td = document.createElement('td');
                td.innerText = grpNode.sts[crosstable.statisticProps[i]];
                td.className = 'sts-cell';

                tr.appendChild(td);
            }
            if (options.extCols) {
                for (var i = 0; i < options.extCols.length; i++) {
                    var td = document.createElement('td');
                    td.innerHTML = options.extCols[i].htmlContent(grpNode);
                    tr.appendChild(td)
                }
            }
            etd.colSpan = maxLevel;
            maxGrpCount++;
        }

        if (level != 0)
            gtd.rowSpan = maxGrpCount;
        maxLevel++;

        return {
            maxLevel, maxGrpCount
        }
    }
}

// 预统计以加快后续统计
/**
 * 预处理统计数据
 *
 * @param {number} resultLevel - 要更新的结果层级对象
 * @param {Object} obj - 包含统计数据的对象
 * @param {statisticItem[]} statisticProps - 统计属性数组
 * @returns {void}
*/
function preSt(resultLevel, obj, statisticProps) {
    if (!resultLevel.hasOwnProperty("prests"))
        resultLevel.prests = {};

    for (var k = 0; k < statisticProps.length; k++) {
        var prop = statisticProps[k].prop;
        var showname = statisticProps[k].showname;

        if (!resultLevel.prests.hasOwnProperty(showname)) {
            resultLevel.prests[showname] = {
                sum: 0,
                count: 0,
                countIfNotNull: 0,
            };
        }
        if (obj.hasOwnProperty(prop)) {
            var value = toNumberOrDefault(obj[prop], 0);
            resultLevel.prests[showname].sum += value;

            if (obj[prop] && obj[prop] != null)
                resultLevel.prests[showname].countIfNotNull++;
        }
        resultLevel.prests[showname].count++;
    }
}

// 递归计算result中的统计值
function calcResult(result, statisticProps) {
    result.sts = {};
    // 第一遍，计算基本统计值
    for (var i = 0; i < statisticProps.length; i++) {
        if (typeof (statisticProps[i].method) === "function")
            continue;
        var showname = statisticProps[i].showname;
        result.sts[showname] = calcDatas(result, result.reldatas, statisticProps[i]);
    }
    // 第二遍，计算自定义统计值
    for (var i = 0; i < statisticProps.length; i++) {
        if (!typeof (statisticProps[i].method) === "function")
            continue;
        var showname = statisticProps[i].showname;
        result.sts[showname] = calcDatas(result, result.reldatas, statisticProps[i]);
    }

    for (var i = 0; i < result.subs.length; i++) {
        calcResult(result.subs[i], statisticProps);
    }
}

function calcDatas(result, datas, stItem) {
    var method = stItem.method;
    var showname = stItem.showname;
    var prests = result.prests[showname];

    var value = 0;


    if (typeof (method) === 'function') {
        value = method(result.sts, datas);
    }
    else if (method === 'sum') {
        value = prests.sum;
    }
    else if (method === 'count') {
        value = prests.count;
    }
    else if (method === 'avg') {
        value = prests.sum / prests.count;
    }
    else if (method === 'count2') {
        value = prests.countIfNotNull;
    }
    else if (method === 'avg2') {
        value = prests.sum / prests.countIfNotNull;
    }
    // 其它计算逻辑，可能需要根据具体需求进行修改
    //...
    else value = "not support " + method;

    // 格式化

    try {
        if (typeof (stItem.format) === 'function')
            value = stItem.format(value);
        else if (typeof (stItem.format) === 'number')
            value = value.toFixed(stItem.format);
        else if (typeof (stItem.format) === 'string')
            value = value.toFixed(toNumberOrDefault(stItem.format, 0));
        return value;
    }
    catch (err) {
        return 'format error';

    }

    return value;
}

function toNumberOrDefault(obj, defaultvalue = 0) {
    var n = Number(obj);
    if (isNaN(n))
        return defaultvalue;
    else
        return n;
}

// 递归清理result中的辅助数据
function clearResult(result) {
    delete result.reldatas;
    delete result.indexmap;
    delete result.prests;
    for (var i = 0; i < result.subs.length; i++) {
        clearResult(result.subs[i]);
    }
}

function printResult(result, level) {
    if (level === undefined) level = 0;

    var indent = '';
    for (var i = 0; i < level; i++) {
        indent += '------';
    }
    console.log(indent + result.v + '    ' + JSON.stringify(result.sts));

    for (var i = 0; i < result.subs.length; i++) {
        printResult(result.subs[i], level + 1);
    }
}
