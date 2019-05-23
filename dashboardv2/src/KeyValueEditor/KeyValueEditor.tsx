import * as React from 'react';

import { Checkmark as CheckmarkIcon, Copy as CopyIcon, StatusWarning as WarningIcon } from 'grommet-icons';
import { Box, Button, TextInput } from 'grommet';
import Notification from '../Notification';
import copyToClipboard from '../util/copyToClipboard';
import {
	Data,
	Entry,
	hasIndex as hasDataIndex,
	nextIndex as nextDataIndex,
	setKeyAtIndex,
	setValueAtIndex,
	appendEntry,
	getEntries,
	filterData,
	mapEntries,
	MapEntriesOption
} from './KeyValueData';
import { KeyValueInput, Selection as InputSelection } from './KeyValueInput';
import useDebouncedInputOnChange from '../useDebouncedInputOnChange';

type DataCallback = (data: Data) => void;

export interface Props {
	data: Data;
	onChange: DataCallback;
	onSubmit: DataCallback;
	keyPlaceholder?: string;
	valuePlaceholder?: string;
	submitLabel?: string;
	conflictsMessage?: string;
}

interface Selection extends InputSelection {
	entryIndex: number;
	entryInnerIndex: 0 | 1; // key | val
}

export default function KeyValueEditor({
	data,
	onChange,
	onSubmit,
	keyPlaceholder = 'Key',
	valuePlaceholder = 'Value',
	submitLabel = 'Review Changes',
	conflictsMessage = 'Some entries have conflicts'
}: Props) {
	const hasConflicts = React.useMemo(() => (data.conflicts || []).length > 0, [data.conflicts]);
	const [searchInputValue, searchInputHandler] = useDebouncedInputOnChange(
		'',
		(value: string) => {
			onChange(filterData(data, value));
		},
		300
	);

	const inputs = React.useMemo(
		() => {
			return {
				currentSelection: null as Selection | null,
				refs: [] as [HTMLInputElement | HTMLTextAreaElement | null, HTMLInputElement | HTMLTextAreaElement | null][]
			};
		},
		[] // eslint-disable-line react-hooks/exhaustive-deps
	);
	inputs.refs = [];
	const setCurrentSelection = (s: Selection) => {
		inputs.currentSelection = s;
	};

	// focus next entry's input when entry deleted
	React.useLayoutEffect(
		() => {
			if (!inputs.currentSelection) return;
			const { entryIndex, entryInnerIndex } = inputs.currentSelection;
			if (!hasDataIndex(data, entryIndex)) {
				const nextIndex = nextDataIndex(data, entryIndex);
				const ref = (inputs.refs[nextIndex] || [])[entryInnerIndex];
				if (ref) {
					const length = ref.value.length;
					const selectionStart = length;
					const selectionEnd = length;
					const selectionDirection = 'forward';
					ref.focus();
					ref.setSelectionRange(selectionStart, selectionEnd, selectionDirection);
				}
			}
		},
		[data] // eslint-disable-line react-hooks/exhaustive-deps
	);

	function keyChangeHandler(index: number, key: string) {
		let nextData: Data;
		nextData = setKeyAtIndex(data, key, index);
		onChange(nextData);
	}

	function valueChangeHandler(index: number, value: string) {
		onChange(setValueAtIndex(data, value, index));
	}

	function selectionChangeHandler(entryIndex: number, entryInnerIndex: 0 | 1, selection: InputSelection) {
		setCurrentSelection({
			entryIndex,
			entryInnerIndex,
			...selection
		});
	}

	function inputRefHandler(entryIndex: number, entryInnerIndex: 0 | 1, ref: any) {
		let entryRefs = inputs.refs[entryIndex] || [null, null];
		if (entryInnerIndex === 0) {
			entryRefs = [ref as HTMLInputElement | HTMLTextAreaElement | null, entryRefs[1]];
		} else {
			entryRefs = [entryRefs[0], ref as HTMLInputElement | HTMLTextAreaElement | null];
		}
		inputs.refs[entryIndex] = entryRefs;
	}

	function handlePaste(event: React.ClipboardEvent) {
		// Detect key=value paste
		const text = event.clipboardData.getData('text/plain');
		if (text.match(/^(\S+=\S+\n?)+$/)) {
			let nextData = data;
			event.preventDefault();
			text
				.trim()
				.split('\n')
				.forEach((line) => {
					const [key, val] = line.split('=');
					nextData = appendEntry(nextData, key, val);
				});
			onChange(nextData);
		}
	}

	function handleCopyButtonClick(event: React.SyntheticEvent) {
		event.preventDefault();

		const text = getEntries(data)
			.map(([key, val]: [string, string]) => {
				return `${key}=${val}`;
			})
			.join('\n');

		copyToClipboard(text);
	}

	return (
		<form
			onSubmit={(e: React.SyntheticEvent) => {
				e.preventDefault();
				onSubmit(data);
			}}
		>
			<Box direction="column" gap="xsmall">
				{hasConflicts ? <Notification status="warning" message={conflictsMessage} /> : null}
				<TextInput type="search" value={searchInputValue} onChange={searchInputHandler} />
				{mapEntries(
					data,
					([key, value, { rebaseConflict, originalValue }]: Entry, index: number) => {
						const hasConflict = rebaseConflict !== undefined;
						return (
							<Box key={index} direction="row" gap="xsmall">
								<KeyValueInput
									refHandler={inputRefHandler.bind(null, index, 0)}
									placeholder={keyPlaceholder}
									value={key}
									hasConflict={hasConflict}
									onChange={keyChangeHandler.bind(null, index)}
									onSelectionChange={selectionChangeHandler.bind(null, index, 0)}
									onPaste={handlePaste}
								/>
								<KeyValueInput
									refHandler={inputRefHandler.bind(null, index, 1)}
									placeholder={valuePlaceholder}
									value={value}
									newValue={hasConflict ? originalValue : undefined}
									onChange={valueChangeHandler.bind(null, index)}
									onSelectionChange={selectionChangeHandler.bind(null, index, 1)}
									onPaste={handlePaste}
								/>
							</Box>
						);
					},
					MapEntriesOption.APPEND_EMPTY_ENTRY
				)}
			</Box>
			<Button
				disabled={!data.hasChanges}
				type="submit"
				primary
				icon={hasConflicts ? <WarningIcon /> : <CheckmarkIcon />}
				label={submitLabel}
			/>
			&nbsp;
			<Button type="button" icon={<CopyIcon />} onClick={handleCopyButtonClick} />
		</form>
	);
}