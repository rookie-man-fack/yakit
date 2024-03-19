import {memo, useMemo, useRef, useState, CSSProperties, useLayoutEffect, useEffect} from "react"
import {useLatest, useMemoizedFn, useUpdateEffect} from "ahooks"
import {YakitSpin} from "../YakitSpin/YakitSpin"
import {YakitTimeLineListProps, YakitVirtualListPositionProps, YakitVirtualListProps} from "./YakitTimeLineListType"
import {YakitTimeLineItemIcon} from "./icon"

import styles from "./YakitTimeLineList.module.scss"

/** @name time-line的单项高度默认值为44px */
const DefaultItemHeight = 44
export const YakitTimeLineList: <T>(props: YakitTimeLineListProps<T>) => any = memo((props) => {
    const {loading = false, data = [], icon, renderItem, hasMore = true, loadMore} = props

    const dataSource = useMemo(() => {
        return data.map((item, index) => {
            return {index: index, data: item}
        })
    }, [data])

    const wrapperRef = useRef<HTMLDivElement>(null)
    const bodyRef = useRef<HTMLDivElement>(null)

    /** 记录单项的位置信息 */
    const positions = useRef<YakitVirtualListPositionProps[]>([])

    /** 基础信息 */
    const [state, setState] = useState<YakitVirtualListProps>({
        viewHeight: 0,
        listHeight: 0,
        startIndex: 0,
        maxCount: 0,
        preLen: 0
    })
    /** 最新的基础信息 */
    const latestState = useLatest(state)

    // 视口最后一个单项的索引
    const endIndex = useMemo(() => {
        return Math.min(dataSource.length, state.startIndex + state.maxCount)
    }, [dataSource, state.startIndex, state.maxCount])
    // 视口渲染列表的数据
    const renderList = useMemo(() => {
        return dataSource.slice(state.startIndex, endIndex)
    }, [dataSource, state.startIndex, endIndex])
    // 视口偏移位置
    const offsetDis = useMemo(() => {
        if (positions.current.length === 0) return 0
        return state.startIndex > 0 ? positions.current[state.startIndex - 1].bottom : 0
    }, [state.startIndex])

    // 滚动样式
    const scrollStyle = useMemo(() => {
        return {
            height: `${state.listHeight - offsetDis}px`,
            transform: `translate3d(0,${offsetDis}px,0)`
        } as CSSProperties
    }, [state.listHeight, offsetDis])

    // 数据源改变的初始化
    useLayoutEffect(() => {
        if (positions.current.length !== data.length) initPosition()
    }, [data.length])
    // 数据源渲染后的实际数据收集
    // 不加延时获取不到初始时的数据节点dom
    useEffect(() => {
        setTimeout(() => {
            setPosition()
        }, 300)
    }, [data.length])

    // 初始化position信息
    const initPosition = useMemoizedFn(() => {
        const pos: YakitVirtualListPositionProps[] = []
        const disLen = dataSource.length - latestState.current.preLen
        const currentLen = positions.current.length
        const preBottom = positions.current[currentLen - 1] ? positions.current[currentLen - 1].bottom : 0
        for (let i = 0; i < disLen; i++) {
            pos.push({
                key: i + latestState.current.preLen,
                height: DefaultItemHeight,
                top: preBottom ? preBottom + (i + 1) * DefaultItemHeight : i * DefaultItemHeight,
                bottom: preBottom ? preBottom + (i + 1) * DefaultItemHeight : (i + 1) * DefaultItemHeight,
                dHeight: 0
            })
        }
        positions.current = [...positions.current, ...pos]
        setState({...latestState.current, preLen: dataSource.length})
    })
    // 数据 item 渲染完成后，更新数据item的真实高度
    const setPosition = useMemoizedFn(() => {
        if (!bodyRef || !bodyRef.current) return
        const nodes = bodyRef.current.children
        if (!nodes || !nodes.length) return
        // positions被重置后触发视口的位置计算问题避免
        if (positions.current.length === 0) return

        // 视口第一个元素索引
        let viewFirst: number = -1
        ;[...nodes].forEach((node) => {
            const rect = node.getBoundingClientRect()

            let key: number = -1
            // 获取节点的索引
            const {attributes} = node || {}
            if (!attributes) return
            for (let el of attributes) {
                if (el.name.indexOf("data-yakit-time-line-item-key") > -1) {
                    try {
                        let strs = el.value.split("-")
                        key = +strs[strs.length - 1] === 0 ? 0 : +strs[strs.length - 1] || -1
                        // 供下面设置真实position使用
                        if (viewFirst === -1 && key !== -1) viewFirst = key
                    } catch (error) {}
                    break
                }
            }

            if (key === -1) return

            const item = positions.current[key]
            const dHeight = item.height - rect.height
            if (dHeight) {
                item.height = rect.height
                item.bottom = item.bottom - dHeight
                item.dHeight = dHeight
            }
        })

        const len = positions.current.length
        let startHeight = positions.current[viewFirst].dHeight
        positions.current[viewFirst].dHeight = 0
        for (let i = viewFirst + 1; i < len; i++) {
            const item = positions.current[i]
            item.top = positions.current[i - 1].bottom
            item.bottom = item.bottom - startHeight
            if (item.dHeight !== 0) {
                startHeight += item.dHeight
                item.dHeight = 0
            }
        }
        setState({...latestState.current, listHeight: positions.current[len - 1].bottom})
        // 数据不足以撑满页面时，自动加载更多
        if (wrapperRef && wrapperRef.current) {
            try {
                const rect = wrapperRef.current.getBoundingClientRect()
                if (latestState.current.listHeight <= rect.height) {
                    if (!loading && hasMore && loadMore) loadMore()
                }
            } catch (error) {}
        }
    })

    useUpdateEffect(() => {
        setPosition()
    }, [state.startIndex])

    // 滚动事件
    const handleScroll = useMemoizedFn(() => {
        if (wrapperRef && wrapperRef.current) {
            const {scrollTop, clientHeight, scrollHeight} = wrapperRef.current
            setState({...latestState.current, startIndex: binarySearch(positions.current, scrollTop)})
            const bottom = scrollHeight - clientHeight - scrollTop
            if (bottom <= 20) {
                if (!loading && hasMore && loadMore) loadMore()
            }
        }
    })
    // 二分法查找 startIndex
    const binarySearch = (list: YakitVirtualListPositionProps[], value: number) => {
        let left = 0,
            right = list.length - 1,
            templateIndex = -1
        while (left < right) {
            const midIndex = Math.floor((left + right) / 2)
            const midValue = list[midIndex].bottom
            if (midValue === value) return midIndex + 1
            else if (midValue < value) left = midIndex + 1
            else if (midValue > value) {
                if (templateIndex === -1 || templateIndex > midIndex) templateIndex = midIndex
                right = midIndex
            }
        }
        return templateIndex
    }

    // 初始化 基础信息
    const init = useMemoizedFn(() => {
        if (wrapperRef && wrapperRef.current) {
            const view = wrapperRef.current.offsetHeight || 0
            const max = Math.ceil(view / DefaultItemHeight) + 1
            setState({...latestState.current, viewHeight: view, maxCount: max})
            wrapperRef.current.addEventListener("scroll", handleScroll)
        }
    })

    useEffect(() => {
        init()
        return () => {
            if (wrapperRef && wrapperRef.current) {
                wrapperRef.current.removeEventListener("scroll", handleScroll)
            }
        }
    }, [])

    return (
        <div ref={wrapperRef} className={styles["yakit-time-line-list-wrapper"]}>
            <div ref={bodyRef} style={scrollStyle}>
                {renderList.map((el) => {
                    const isShowTail = el.index !== dataSource.length - 1
                    return (
                        <div
                            data-yakit-time-line-item-key={`time-line-item-${el.index}`}
                            key={`time-line-item-${el.index}`}
                            className={styles["time-line-item-wrapper"]}
                        >
                            <div className={styles["time-line-head"]}>
                                <div className={styles["icon-stlye"]}>
                                    {icon ? icon(el.data) : <YakitTimeLineItemIcon />}
                                </div>

                                {isShowTail && <div className={styles["time-line-tail"]}></div>}
                            </div>
                            <div className={styles["time-line-content"]}>{renderItem(el.data, el.index)}</div>
                        </div>
                    )
                })}
                {loading && hasMore && (
                    <div className={styles["time-line-item-loading"]}>
                        <YakitSpin spinning={true} wrapperClassName={styles["spin-style"]} />
                    </div>
                )}
                {!loading && !hasMore && <div className={styles["time-line-item-bottom"]}>已经到底啦 ~</div>}
            </div>
        </div>
    )
})
