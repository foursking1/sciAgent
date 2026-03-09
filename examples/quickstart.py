#!/usr/bin/env python3
"""
Agentic Data Scientist 快速入门脚本

最简单的使用方式：
    uv run python examples/quickstart.py
"""

from agentic_data_scientist import DataScientist


def main():
    # 1. 创建实例 (简单模式)
    ds = DataScientist(
        agent_type="claude_code",  # 简单模式：直接使用 Claude Code
        working_dir="./agentic_output",
        auto_cleanup=False,
    )

    # 2. 运行任务
    result = ds.run(
        message="创建一个 Python 脚本，生成随机数据并绘制直方图",
    )

    # 3. 查看结果
    if result.status == "completed":
        print("\n=== 响应 ===")
        print(result.response)

        if result.files_created:
            print(f"\n=== 创建的文件 ({len(result.files_created)}) ===")
            for f in result.files_created:
                print(f"  - {f}")

        print(f"\n耗时：{result.duration:.2f}秒")
        print(f"工作目录：{ds.working_dir}")

    # 4. 清理资源
    ds.cleanup()


if __name__ == "__main__":
    main()
