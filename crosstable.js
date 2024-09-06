/**
 * 交叉表
 * @param {[any]} objs 数据源
 * @param {[string]} lineGrpProps 行分组属性
 * @param {[string]]} colGrpProps 列分组属性
 * @param {[{prop:string, method:'sum|count|avg'}]} statisticProps 统计属性
 * @returns { k: string, v: any, indexmap: object, reldatas: [object], sts:[{}], subs: [], }
 */

function CrossTable(objs, lineGrpProps, colGrpProps, statisticProps, options) {


    if (!lineGrpProps) lineGrpProps = [];
    if (!colGrpProps) colGrpProps = [];
    if (!statisticProps) statisticProps = [];

    var result = { k: '', v: '', indexmap: {}, reldatas: [], subs: [], sts: [] };

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
                    sts: []
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

    tr = document.createElement('tr');
    tab.appendChild(tr);

    RenderCrossLineGrpNode(crosstable, tab, tr, 0, options);

    /**
     * 
     * @param {*} grpNode 
     * @param {*} tab 
     * @param {*} options 
     * @returns 
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
                td.innerText = grpNode.sts[crosstable.statisticProps[i]].toFixed(2);

                td.className = 'sts-cell';
                tr.appendChild(td);
            }
            maxGrpCount++;
        }

        // 小计
        if (grpNode.subs.length != 0 && !options.hideSum) {
            // 小计前先填充空格
            tr = document.createElement('tr');
            tab.appendChild(tr);
            tr.className = 'total-row';
            var etd = document.createElement('td');
            etd.innerText = '小计';
            etd.className = 'grp-cell';

            tr.appendChild(etd);

            for (var i = 0; i < crosstable.statisticProps.length; i++) {
                var td = document.createElement('td');
                td.innerText = grpNode.sts[crosstable.statisticProps[i]].toFixed(2);
                td.className = 'sts-cell';

                tr.appendChild(td);
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
    var st = {};
    for (var i = 0; i < statisticProps.length; i++) {
        var showname = statisticProps[i].showname;
        st[showname] = calcDatas(result, result.reldatas, statisticProps[i]);
    }
    result.sts = st;

    for (var i = 0; i < result.subs.length; i++) {
        calcResult(result.subs[i], statisticProps);
    }
}

function calcDatas(result, datas, stItem) {
    var method = stItem.method;
    var showname = stItem.showname;
    var prests = result.prests[showname];

    if (method === 'sum') {
        return prests.sum;
    } else if (method === 'count') {
        return prests.count;
    } else if (method === 'avg') {
        return prests.sum / prests.count;
    } else if (method === 'count2') {
        return prests.countIfNotNull;
    } else if (method === 'avg2') {
        return prests.sum / prests.countIfNotNull;
    }
    // 其它计算逻辑，可能需要根据具体需求进行修改
    //...

    return "not support " + method;
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
