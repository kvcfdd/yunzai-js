import json
import math
import os
from collections import defaultdict

# 使用前请先修改以下路径
# 原神极限面板文件
EXTREME_TARGET_JSON_FILE = 'Yunzai/resources/presetPanelData/gs/100000000.json'
# 原神核爆面板文件
NUKE_TARGET_JSON_FILE = 'Yunzai/resources/presetPanelData/gs/100000001.json'

# 角色数据源文件
CHAR_DATA_FILE = 'miao-plugin/resources/meta-gs/character/data.json'
# 圣遗物数据源文件
ARTIS_DATA_FILE = 'miao-plugin/resources/meta-gs/artifact/data.json'

class GenshinDataParser:
    def __init__(self, char_file, artis_file, target_file):
        self._initialize_maps()
        self.char_data = self._load_json(char_file)
        self.artis_data = self._load_json(artis_file)
        self.target_data = self._load_json(target_file)
        
    def _initialize_maps(self):
        self.main_id_map = {
            "10001": "hpPlus", "10002": "hp", "10003": "atkPlus", "10004": "atk",
            "10005": "defPlus", "10006": "def", "10007": "recharge", "10008": "mastery",
            "13007": "cpct", "13008": "cdmg", "13009": "heal"
        }
        self.elem_dmg_map = {
            'pyro': '15008', 'electro': '15009', 'cryo': '15010', 'hydro': '15011',
            'anemo': '15012', 'geo': '15013', 'dendro': '15014', 'phy': '15015'
        }
        self.sub_attr_max_ids = {
            'hp': '501034', 'hpPlus': '501024', 'atk': '501064', 'atkPlus': '501054',
            'def': '501094', 'defPlus': '501084', 'cpct': '501204', 'cdmg': '501224',
            'mastery': '501244', 'recharge': '501234'
        }

    def _load_json(self, filepath):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"加载文件 '{filepath}' 时出错: {e}"); exit()
        return {}

class PanelGenerator:
    def __init__(self, data_parser, target_file_path):
        self.parser = data_parser
        self.target_file_path = target_file_path
        self.five_star_sets = self._get_5star_sets()
        self.sub_stat_options = {
            "攻击": ["atk", "atkPlus"],
            "生命": ["hp", "hpPlus"],
            "防御": ["def", "defPlus"],
            "元素精通": ["mastery"],
            "元素充能": ["recharge"],
            "暴击率": ["cpct"],
            "暴击伤害": ["cdmg"]
        }

    def _get_5star_sets(self):
        sets = [v for v in self.parser.artis_data.values() if isinstance(v.get('idxs'), dict) and len(v['idxs']) == 5]
        return sorted(sets, key=lambda x: int(x.get('id', 0)))
        
    def select_artifact_set(self):
        print("\n--- 请选择圣遗物套装 ---")
        for i, artifact_set in enumerate(self.five_star_sets): print(f"[{i + 1}] {artifact_set['name']}")
        while True:
            try:
                choice = int(input("请输入套装编号: ").strip())
                if 1 <= choice <= len(self.five_star_sets): return self.five_star_sets[choice - 1]
                else: print("编号无效，请重新输入。")
            except ValueError: print("请输入一个有效的数字。")
    
    def _select_sub_stats(self, exclude=None):
        if exclude is None: exclude = []
        print("\n--- 请选择 2-4 个优先副词条 (按优先级顺序输入) ---")
        
        available_options = {name: keys for name, keys in self.sub_stat_options.items() if not any(k in exclude for k in keys)}
        available_option_names = list(available_options.keys())

        for i, name in enumerate(available_option_names): print(f"[{i + 1}] {name}")
        
        while True:
            choice_str = input("请输入 2-4 个副词条编号 (例如: 1234): ").strip()
            
            if not choice_str.isdigit():
                print("错误: 输入必须是纯数字。"); continue
            if not (2 <= len(choice_str) <= 4):
                print("错误: 请输入 2 到 4 位数字。"); continue
            if len(set(choice_str)) != len(choice_str):
                print("错误: 请勿输入重复的编号。"); continue

            selected_keys = []
            valid_input = True
            for char_choice in choice_str:
                choice = int(char_choice)
                if 1 <= choice <= len(available_option_names):
                    selected_keys.append(available_options[available_option_names[choice - 1]])
                else:
                    print(f"错误: 编号 '{choice}' 无效。"); valid_input = False; break
            
            if valid_input:
                return [key for group in selected_keys for key in group]

    def list_missing_characters(self):
        all_chars = set(self.parser.char_data.keys())
        existing_chars = set(self.parser.target_data.get('avatars', {}).keys())
        ignore_ids = {'10000005', '10000007', '20000000'}
        missing_chars_id = sorted([cid for cid in (all_chars - existing_chars - ignore_ids) if cid in self.parser.char_data])
        if not missing_chars_id: print(f"\n所有角色数据均已存在于 {os.path.basename(self.target_file_path)} 中。"); return
        print(f"\n--- 以下角色数据尚未写入 {os.path.basename(self.target_file_path)} ---")
        for char_id in missing_chars_id: print(f"ID: {char_id:<10} 名称: {self.parser.char_data[char_id]['name']}")
        print("-" * 40)

    def generate(self, mode='extreme'):
        selected_set = self.select_artifact_set()
        char_name_input = input("请输入要生成的角色中文名: ").strip()
        target_char_id, target_char_info = next(((cid, cinfo) for cid, cinfo in self.parser.char_data.items() if cinfo.get('name') == char_name_input), (None, None))
        if not target_char_id: print(f"错误: 找不到名为 '{char_name_input}' 的角色。"); return
        weapon_name = input("请输入武器名称: ").strip()
        
        main_stats = {'flower': 'hpPlus', 'plume': 'atkPlus', 'goblet': target_char_info['elem']}
        
        if mode == 'mastery':
            main_stats.update({'sands': 'mastery', 'goblet': 'mastery', 'circlet': 'mastery'})
            user_priority_subs = self._select_sub_stats(exclude=['mastery'])
            print_rolls_info = "极限精通"
        elif mode == 'extreme':
            valid_main_stats = {'atk', 'hp', 'def', 'mastery', 'recharge'}
            sands_main_stat = ''
            while sands_main_stat not in valid_main_stats: sands_main_stat = input("请选择【沙漏】主词条 (atk/hp/def/mastery/recharge): ").strip().lower()
            main_stats['sands'] = sands_main_stat
            user_priority_subs = self._select_sub_stats()
            main_stats['circlet'] = 'cdmg'
            try: existing_cr = float(input("请输入角色已有的暴击率 (不含基础5%): ").strip())
            except ValueError: print("输入无效。"); return
            cr_needed = 100.0 - 5.0 - existing_cr
            if cr_needed > (3.89 * 6 * 5): 
                main_stats['circlet'] = 'cpct'
                print("\n注意: 暴击率需求过高，已自动切换为【暴击头】。")
                cr_needed -= 31.1
            cr_rolls_needed = math.ceil(cr_needed / 3.89) if cr_needed > 0 else 0
            if cr_rolls_needed > 30: cr_rolls_needed = 30
            cdmg_rolls = 45 - cr_rolls_needed
            print_rolls_info = f"{cr_rolls_needed} 暴击 | {cdmg_rolls} 爆伤"
            roll_pool = ['cpct'] * cr_rolls_needed + ['cdmg'] * cdmg_rolls
        elif mode == 'nuke':
            valid_main_stats = {'atk', 'hp', 'def', 'mastery', 'recharge'}
            sands_main_stat = ''
            while sands_main_stat not in valid_main_stats: sands_main_stat = input("请选择【沙漏】主词条 (atk/hp/def/mastery/recharge): ").strip().lower()
            main_stats['sands'] = sands_main_stat
            user_priority_subs = self._select_sub_stats(exclude=['cpct'])
            main_stats['circlet'] = 'cdmg'
            print_rolls_info = "极限爆伤"

        print("\n--- 计算结果 ---")
        mode_name = "平衡双暴" if mode == 'extreme' else "极限爆伤" if mode == 'nuke' else "极限精通"
        print(f"面板类型: {mode_name}")
        print(f"圣遗物套装: {selected_set['name']}")
        print(f"主词条: 沙({main_stats['sands']}), 杯({main_stats['goblet']}), 头({main_stats['circlet']})")
        print(f"词条分配: {print_rolls_info}")
        if user_priority_subs: print(f"副词条优先级: {', '.join(user_priority_subs)}")
        print("-" * 30)

        artifacts = {}
        for i, piece_type in enumerate(['flower', 'plume', 'sands', 'goblet', 'circlet']):
            main_stat_name = main_stats[piece_type]
            main_id = self.parser.elem_dmg_map.get(main_stat_name) or \
                      next((k for k, v in self.parser.main_id_map.items() if v == main_stat_name), "0")
            
            piece_rolls = defaultdict(int)

            final_subs = []
            mode_priority_subs = []
            if mode == 'extreme': mode_priority_subs = ['cpct', 'cdmg']
            elif mode == 'nuke': mode_priority_subs = ['cdmg']
            elif mode == 'mastery' and piece_type in ['flower', 'plume']: mode_priority_subs = ['mastery']
            
            full_priority_list = mode_priority_subs + user_priority_subs
            added_stats = set()
            for stat in full_priority_list:
                if len(final_subs) >= 4: break
                if stat not in added_stats and stat != main_stat_name:
                    final_subs.append(stat)
                    added_stats.add(stat)

            fallback_subs = ['recharge', 'atk', 'hp', 'def', 'mastery', 'atkPlus', 'hpPlus', 'defPlus', 'cdmg', 'cpct']
            for fb_stat in fallback_subs:
                if len(final_subs) >= 4: break
                if fb_stat not in added_stats and fb_stat != main_stat_name:
                    final_subs.append(fb_stat)
                    added_stats.add(fb_stat)

            for sub in final_subs: piece_rolls[sub] = 1

            upgrades_left = 5
            if mode == 'extreme':
                for _ in range(upgrades_left):
                    stat_to_add = next((s for s in ['cpct', 'cdmg'] if s in roll_pool and piece_rolls.get(s, 0) < 6), None)
                    if stat_to_add:
                        piece_rolls[stat_to_add] += 1
                        roll_pool.remove(stat_to_add)
                    else:
                        upgrade_priority = [s for s in user_priority_subs if s in final_subs]
                        for stat in upgrade_priority:
                            if piece_rolls[stat] < 6:
                                piece_rolls[stat] += 1
                                break
            else:
                upgrade_priority = [s for s in full_priority_list if s in final_subs]
                if not upgrade_priority: upgrade_priority = final_subs

                for stat in upgrade_priority:
                    if upgrades_left == 0: break
                    can_add = 6 - piece_rolls[stat]
                    add_count = min(upgrades_left, can_add)
                    piece_rolls[stat] += add_count
                    upgrades_left -= add_count

            attr_ids = [int(self.parser.sub_attr_max_ids[stat]) for stat, count in piece_rolls.items() for _ in range(count)]
            artifacts[str(i + 1)] = {"level": 20, "star": 5, "name": selected_set['idxs'][str(i + 1)]['name'], "mainId": int(main_id), "attrIds": attr_ids}

        new_char_data = {"name": target_char_info["name"], "id": int(target_char_id), "elem": target_char_info["elem"], "level": 100, "promote": 6, "fetter": 10, "costume": 0, "cons": 6, "talent": {"a": 10, "e": 10, "q": 10}, "weapon": {"name": weapon_name, "level": 90, "promote": 6, "affix": 5}, "artis": artifacts, "_source": "enka", "_time": 1601258400, "_update": 1601258400, "_talent": 1601258400}
        
        avatars_dict = self.parser.target_data.setdefault("avatars", {})
        avatars_dict[str(target_char_id)] = new_char_data
        self.parser.target_data["avatars"] = {k: v for k, v in sorted(avatars_dict.items(), key=lambda item: int(item[0]))}
        with open(self.target_file_path, 'w', encoding='utf-8') as f: json.dump(self.parser.target_data, f, ensure_ascii=False, indent=2)
        print(f"\n成功！角色【{char_name_input}】的面板数据已有序地写入/更新至 {self.target_file_path}")

def main_loop():
    while True:
        print("\n===== 模式选择 =====")
        print("1. 极限/精通面板 (写入 100000000.json)")
        print("2. 核爆面板 (写入 100000001.json)")
        print("3. 退出")
        mode_choice = input("请选择模式: ").strip()

        if mode_choice == '1':
            target_file, name = EXTREME_TARGET_JSON_FILE, '极限面板'
            print("\n--- 请选择极限面板类型 ---")
            print("1. 平衡双暴")
            print("2. 极限精通")
            print("3. 返回")
            sub_mode_choice = input("请选择类型: ").strip()
            if sub_mode_choice == '1': mode = 'extreme'
            elif sub_mode_choice == '2': mode = 'mastery'
            else: continue
        elif mode_choice == '2':
            target_file, mode, name = NUKE_TARGET_JSON_FILE, 'nuke', '核爆面板'
        elif mode_choice == '3':
            print("程序已退出。"); break
        else:
            print("无效输入。"); continue

        if not os.path.exists(target_file):
            print(f"目标文件 '{target_file}' 不存在，将创建一个新文件。")
            try:
                with open(target_file, 'w', encoding='utf-8') as f: json.dump({"uid": os.path.basename(target_file).split('.')[0], "name": name, "avatars": {}}, f, indent=2)
            except IOError as e: print(f"错误: 无法创建文件 '{target_file}': {e}"); continue
        
        data_parser = GenshinDataParser(CHAR_DATA_FILE, ARTIS_DATA_FILE, target_file)
        generator = PanelGenerator(data_parser, target_file)

        while True:
            mode_name = "平衡双暴" if mode == 'extreme' else "极限精通" if mode == 'mastery' else "极限爆伤"
            print(f"\n--- 当前模式: {mode_name} ---")
            print("1. 查看未收录角色列表")
            print("2. 生成新的角色面板")
            print("3. 返回主菜单")
            sub_choice = input("请选择操作: ").strip()
            if sub_choice == '1': generator.list_missing_characters()
            elif sub_choice == '2': generator.generate(mode=mode)
            elif sub_choice == '3': break
            else: print("无效输入。")

if __name__ == "__main__":
    print("--- 欢迎使用原神预设面板生成脚本 ---")
    for path, name in [(CHAR_DATA_FILE, "角色数据"), (ARTIS_DATA_FILE, "圣遗物数据")]:
        if not os.path.exists(path): print(f"错误: {name}文件未找到，请检查顶部的配置路径: {path}"); exit()
    main_loop()