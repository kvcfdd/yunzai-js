import json
import math
import os
from collections import defaultdict

# 使用前请先修改以下路径
# 星铁极限面板文件
HSR_TARGET_JSON_FILE = 'Yunzai/resources/presetPanelData/sr/100000000.json'
# 角色数据文件
HSR_CHAR_DATA_FILE = 'miao-plugin/resources/meta-sr/character/data.json'
# 遗器数据文件
HSR_RELIC_DATA_FILE = 'miao-plugin/resources/meta-sr/artifact/data.json'
# 光锥数据文件
HSR_WEAPON_DATA_FILE = 'miao-plugin/resources/meta-sr/weapon/data.json'
CRIT_RATE_PER_ROLL = 3.24

class StarRailDataParser:
    def __init__(self, char_file, relic_file, weapon_file, target_file):
        self._initialize_maps()
        self.char_data = self._load_json(char_file)
        self.relic_data = self._load_json(relic_file)
        self.weapon_data = self._load_json(weapon_file)
        self.target_data = self._load_json(target_file)
        
    def _initialize_maps(self):
        self.main_stat_map_by_piece = {
            '3': {'hp': 1, 'atk': 2, 'def': 3, 'cpct': 4, 'cdmg': 5, 'heal': 6, 'effPct': 7}, # 躯干
            '4': {'hp': 1, 'atk': 2, 'def': 3, 'speed': 4}, # 脚部
            '5': {'hp': 1, 'atk': 2, 'def': 3, 'phy': 4, 'fire': 5, 'ice': 6, 'elec': 7, 'wind': 8, 'quantum': 9, 'imaginary': 10}, # 位面球
            '6': {'stance': 1, 'recharge': 2, 'hp': 3, 'atk': 4, 'def': 5} # 连结绳
        }
        self.sub_stat_to_id = {
            'hpPlus': 1, 'atkPlus': 2, 'defPlus': 3, 'hp': 4, 'atk': 5, 'def': 6, 'speed': 7,
            'cpct': 8, 'cdmg': 9, 'effPct': 10, 'effDef': 11, 'stance': 12
        }
        self.elem_cn_to_en = { '物理': 'phy', '火': 'fire', '冰': 'ice', '雷': 'elec', '风': 'wind', '量子': 'quantum', '虚数': 'imaginary' }

    def _load_json(self, filepath):
        if not os.path.exists(filepath): return {}
        try:
            with open(filepath, 'r', encoding='utf-8') as f: return json.load(f)
        except Exception as e:
            print(f"错误: 加载文件 '{filepath}' 时出错: {e}"); exit()

class PanelGenerator:
    def __init__(self, data_parser, target_file_path):
        self.parser = data_parser
        self.target_file_path = target_file_path
        self.relic_sets, self.ornament_sets = self._get_5star_sets()
        self.sub_stat_options = { "攻击": ["atk", "atkPlus"], "生命": ["hp", "hpPlus"], "防御": ["def", "defPlus"], "速度": ["speed"], "暴击率": ["cpct"], "暴击伤害": ["cdmg"], "效果命中": ["effPct"], "效果抵抗": ["effDef"], "击破特攻": ["stance"] }

    def _get_5star_sets(self):
        all_sets = sorted(list(self.parser.relic_data.values()), key=lambda x: int(x.get('id', 0)))
        relics, ornaments = [], []
        for s in all_sets:
            is_5star = False
            if 'idxs' in s and s['idxs']:
                first_piece_ids = next(iter(s['idxs'].values())).get('ids', {})
                if any(str(k).startswith('6') for k in first_piece_ids): is_5star = True
            if not is_5star: continue
            if int(s['id']) < 200: relics.append(s)
            else: ornaments.append(s)
        return relics, ornaments

    def _select_from_list(self, item_dict, prompt, filter_func=None):
        print(f"\n--- {prompt} ---")
        filtered_items = {k: v for k, v in item_dict.items() if (filter_func(v) if filter_func else True)}
        if not filtered_items: print("错误：列表中没有可选项。"); return None, None
        for key, value in sorted(filtered_items.items(), key=lambda item: int(item[0])):
            print(f"ID: {key:<6} 名称: {value['name']}")
        while True:
            choice = input("请输入ID: ").strip()
            if choice in filtered_items: return choice, filtered_items[choice]
            else: print("ID无效，请重新输入。")

    def _select_sub_stats(self, prompt, exclude=None, min_select=1, max_select=4):
        if exclude is None: exclude = []
        print(f"\n--- {prompt} ---")
        available_options = {name: keys for name, keys in self.sub_stat_options.items() if not any(k in exclude for k in keys)}
        available_option_names = list(available_options.keys())
        for i, name in enumerate(available_option_names): print(f"[{i + 1}] {name}")
        while True:
            choice_str = input(f"请输入 {min_select}-{max_select} 个副词条编号 (例如: 1234): ").strip()
            if not choice_str.isdigit() or not (min_select <= len(choice_str) <= max_select) or len(set(choice_str)) != len(choice_str):
                print(f"错误: 请输入 {min_select} 到 {max_select} 位不重复的纯数字。"); continue
            selected_keys, valid_input = [], True
            for char_choice in choice_str:
                choice = int(char_choice)
                if 1 <= choice <= len(available_option_names):
                    selected_keys.append(available_options[available_option_names[choice - 1]])
                else: print(f"错误: 编号 '{choice}' 无效。"); valid_input = False; break
            if valid_input: return [key for group in selected_keys for key in group]

    def _get_main_stat_input(self, piece_name, valid_options):
        lowercase_options = [opt.lower() for opt in valid_options]
        prompt = f"请选择【{piece_name}】主词条 ({'/'.join(valid_options)}): "
        while True:
            choice = input(prompt).strip().lower()
            if choice in lowercase_options:
                original_choice = next(opt for opt in valid_options if opt.lower() == choice)
                return original_choice
            print("输入无效，请重新输入。")

    def _get_relic_piece_id(self, relic_set_data, piece_index):
        try:
            piece_data = relic_set_data['idxs'][str(piece_index)]
            for item_id, rarity in piece_data['ids'].items():
                if rarity == 5: return int(item_id)
            print(f"警告: 在套装 {relic_set_data['name']} 中找不到部位 {piece_index} 的5星遗器ID。"); return 0
        except KeyError:
            print(f"错误: 无法在套装 {relic_set_data['name']} 中找到部位 {piece_index} 的数据。"); return 0
            
    def list_missing_characters(self):
        all_chars = self.parser.char_data
        existing_chars_id = set(self.parser.target_data.get('avatars', {}).keys())
        missing_chars = {cid: cinfo for cid, cinfo in all_chars.items() if cid not in existing_chars_id}
        if not missing_chars: print(f"\n所有角色数据均已存在于 {os.path.basename(self.target_file_path)} 中。")
        else:
            print(f"\n--- 以下角色数据尚未写入 {os.path.basename(self.target_file_path)} ---")
            for char_id, char_info in sorted(missing_chars.items(), key=lambda item: int(item[0])):
                print(f"ID: {char_id:<6} 名称: {char_info['name']}")
            print("-" * 40)

    def generate(self, mode='extreme'):
        selected_relic_set = self._select_from_list({s['id']: s for s in self.relic_sets}, "请选择4件套隧洞遗器")[1]
        selected_ornament_set = self._select_from_list({s['id']: s for s in self.ornament_sets}, "请选择2件套位面饰品")[1]
        target_char_id, target_char_info = self._select_from_list(self.parser.char_data, "请选择角色")
        weapon_id, _ = self._select_from_list(self.parser.weapon_data, "请选择5星光锥", filter_func=lambda w: w.get('star') == 5)
        
        main_stats = {'1': ('hpPlus', 1), '2': ('atkPlus', 1)}
        
        target_cr_upgrades = 0
        assigned_cr_upgrades = 0
        user_priority_subs = []
        
        if mode == 'single_stat':
            user_priority_subs = self._select_sub_stats("请选择副词条优先级列表 (至少4个)", min_select=4, max_select=9)
            if not user_priority_subs: return

            print("\n--- 请为 极限单属性 模式选择主词条 ---")
            body_stat = self._get_main_stat_input("躯干", self.parser.main_stat_map_by_piece['3'].keys())
            main_stats['3'] = (body_stat, self.parser.main_stat_map_by_piece['3'][body_stat])
            
            feet_stat = self._get_main_stat_input("脚部", self.parser.main_stat_map_by_piece['4'].keys())
            main_stats['4'] = (feet_stat, self.parser.main_stat_map_by_piece['4'][feet_stat])
            
            sphere_stat = self._get_main_stat_input("位面球", self.parser.main_stat_map_by_piece['5'].keys())
            main_stats['5'] = (sphere_stat, self.parser.main_stat_map_by_piece['5'][sphere_stat])

            rope_stat = self._get_main_stat_input("连结绳", self.parser.main_stat_map_by_piece['6'].keys())
            main_stats['6'] = (rope_stat, self.parser.main_stat_map_by_piece['6'][rope_stat])

        else:
            print("\n[自动配置] 极限双暴模式，自动选择最优主词条：")
            main_stats['3'] = ('cdmg', self.parser.main_stat_map_by_piece['3']['cdmg'])
            print("  - 躯干: 暴击伤害")

            char_elem_en = self.parser.elem_cn_to_en.get(target_char_info['elem'], 'phy')
            main_stats['5'] = (char_elem_en, self.parser.main_stat_map_by_piece['5'][char_elem_en])
            print(f"  - 位面球: {target_char_info['elem']}属性伤害")

            feet_stat = self._get_main_stat_input("脚部", self.parser.main_stat_map_by_piece['4'].keys())
            main_stats['4'] = (feet_stat, self.parser.main_stat_map_by_piece['4'][feet_stat])
            rope_stat = self._get_main_stat_input("连结绳", self.parser.main_stat_map_by_piece['6'].keys())
            main_stats['6'] = (rope_stat, self.parser.main_stat_map_by_piece['6'][rope_stat])
            
            user_priority_subs = self._select_sub_stats("请选择 2 个填充副词条 (双暴词条用尽后生效)", min_select=2, max_select=2, exclude=['cpct', 'cdmg'])
            
            try: total_existing_cr = float(input("请输入角色已有的暴击率 (包括自身天赋/行迹/遗器/光锥提供的总和): ").strip())
            except ValueError: print("输入无效。"); return
            
            cr_needed_from_substats = max(0, 100.0 - total_existing_cr)
            
            initial_cr_stats = 6
            for i in range(3, 7):
                if main_stats.get(str(i), ('',0))[0] == 'cpct':
                    initial_cr_stats -= 1
            
            cr_from_initial = initial_cr_stats * CRIT_RATE_PER_ROLL
            cr_needed_from_upgrades = max(0, cr_needed_from_substats - cr_from_initial)
            
            target_cr_upgrades = math.floor(cr_needed_from_upgrades / CRIT_RATE_PER_ROLL)

            print(f"\n--- 计算结果 --- \n需要通过副词条补足 {cr_needed_from_substats:.2f}% 暴击率")
            print(f"将分配 {target_cr_upgrades} 次升级给暴击率，{30 - target_cr_upgrades} 次给暴击伤害")

        artifacts = {}
        for i in range(1, 7):
            piece_idx = str(i)
            main_stat_name, main_id = main_stats[piece_idx]
            current_set = selected_relic_set if i <= 4 else selected_ornament_set
            piece_id = self._get_relic_piece_id(current_set, i)
            
            final_subs = []
            if mode == 'single_stat':
                priority_order = user_priority_subs
                for sub in user_priority_subs:
                    if len(final_subs) >= 4: break
                    if sub not in final_subs and sub != main_stat_name: final_subs.append(sub)
            else:
                priority_order = ['cpct', 'cdmg'] + user_priority_subs
                if 'cpct' != main_stat_name:
                    final_subs.append('cpct')
                if 'cdmg' != main_stat_name:
                    final_subs.append('cdmg')
                for sub in user_priority_subs:
                    if len(final_subs) >= 4: break
                    if sub not in final_subs and sub != main_stat_name: final_subs.append(sub)

            fallback_subs = ['atk', 'hp', 'def', 'speed', 'effPct', 'stance', 'cdmg', 'cpct']
            for sub in fallback_subs:
                if len(final_subs) >= 4: break
                if sub not in final_subs and sub != main_stat_name: final_subs.append(sub)
            
            piece_rolls = {sub: 1 for sub in final_subs}
            
            if mode == 'extreme':
                for _ in range(5):
                    if assigned_cr_upgrades < target_cr_upgrades and 'cpct' in piece_rolls:
                        piece_rolls['cpct'] += 1
                        assigned_cr_upgrades += 1
                    elif 'cdmg' in piece_rolls:
                        piece_rolls['cdmg'] += 1
                    else:
                        for stat in user_priority_subs:
                            if stat in piece_rolls:
                                piece_rolls[stat] += 1
                                break
            else:
                stat_to_upgrade = None
                for stat in priority_order:
                    if stat in piece_rolls: 
                        stat_to_upgrade = stat
                        break
                
                if stat_to_upgrade:
                    piece_rolls[stat_to_upgrade] += 5
                else:
                    print(f"警告：在部位 {piece_idx} 上找不到任何可升级的优先副词条，该部位未升级。")
            
            roll_count_to_code = {
                1: (1, 2), 2: (2, 4), 3: (3, 6),
                4: (5, 0), 5: (6, 2), 6: (7, 4)
            }
            
            attr_ids = []
            for stat in final_subs:
                stat_id = self.parser.sub_stat_to_id[stat]
                count = piece_rolls.get(stat, 1)
                
                code1, code2 = roll_count_to_code.get(count, (1, 2))
                attr_ids.append(f"{stat_id},{code1},{code2}")
            
            artifacts[piece_idx] = {"level": 15, "star": 5, "id": piece_id, "mainId": main_id, "attrIds": attr_ids}
        
        talent_levels = {"a": 6, "e": 10, "q": 10, "t": 10}
        if target_char_info.get('weapon') == "记忆": talent_levels.update({"me": 6, "mt": 6})
        
        trees = [f"{target_char_id}101", f"{target_char_id}102", f"{target_char_id}103"] + [f"{target_char_id}2{i:02d}" for i in range(1, 11)]

        new_char_data = { "name": target_char_info["name"], "id": int(target_char_id), "elem": target_char_info["elem"], "level": 80, "promote": 6, "cons": 6, "talent": talent_levels, "trees": trees, "weapon": {"id": int(weapon_id), "level": 80, "promote": 6, "affix": 5}, "artis": artifacts, "_source": "hsr-panel-generator", "_time": 1700000000, "_update": 1700000000, "_talent": 1700000000 }
        
        avatars_dict = self.parser.target_data.setdefault("avatars", {})
        avatars_dict[str(target_char_id)] = new_char_data
        self.parser.target_data["avatars"] = {k: v for k, v in sorted(avatars_dict.items(), key=lambda item: int(item[0]))}
        with open(self.target_file_path, 'w', encoding='utf-8') as f: json.dump(self.parser.target_data, f, ensure_ascii=False, indent=2)
        print(f"\n成功！角色【{target_char_info['name']}】的面板数据已有序地写入/更新至 {os.path.basename(self.target_file_path)}")

def main_loop():
    if not os.path.exists(HSR_TARGET_JSON_FILE):
        uid = os.path.basename(HSR_TARGET_JSON_FILE).split('.')[0]
        try:
            with open(HSR_TARGET_JSON_FILE, 'w', encoding='utf-8') as f:
                json.dump({"uid": uid, "name": "预设面板", "avatars": {}}, f, indent=2)
        except IOError as e: print(f"错误: 无法创建文件 '{HSR_TARGET_JSON_FILE}': {e}"); return

    data_parser = StarRailDataParser(HSR_CHAR_DATA_FILE, HSR_RELIC_DATA_FILE, HSR_WEAPON_DATA_FILE, HSR_TARGET_JSON_FILE)
    generator = PanelGenerator(data_parser, HSR_TARGET_JSON_FILE)

    while True:
        print("\n===== 面板生成器 =====")
        print("1. 生成 极限双暴 面板")
        print("2. 生成 极限单属性 面板")
        print("3. 查看未收录角色列表")
        print("4. 退出")
        mode_choice = input("请选择操作: ").strip()

        if mode_choice == '1': generator.generate(mode='extreme')
        elif mode_choice == '2': generator.generate(mode='single_stat')
        elif mode_choice == '3': generator.list_missing_characters()
        elif mode_choice == '4': print("程序已退出。"); break
        else: print("无效输入，请重新选择。")

if __name__ == "__main__":
    print("--- 欢迎使用星铁预设面板生成脚本 ---")
    for path, name in [(HSR_CHAR_DATA_FILE, "角色数据"), (HSR_RELIC_DATA_FILE, "遗器数据"), (HSR_WEAPON_DATA_FILE, "光锥数据")]:
        if not os.path.exists(path):
            print(f"错误: {name}文件未找到，请检查顶部的配置路径: {path}"); exit()
    main_loop()