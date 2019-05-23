import * as React from 'react';
import * as jspb from 'google-protobuf';
import { Checkmark as CheckmarkIcon } from 'grommet-icons';
import { Box, Button } from 'grommet';
import useApp from './useApp';
import useClient from './useClient';
import useCallIfMounted from './useCallIfMounted';
import { handleError } from './withErrorHandler';
import Loading from './Loading';
import KeyValueEditor, { Data as KeyValueData, buildData, rebaseData, getEntries } from './KeyValueEditor';
import KeyValueDiff from './KeyValueDiff';
import protoMapReplace from './util/protoMapReplace';
import { App } from './generated/controller_pb';
import RightOverlay from './RightOverlay';

interface Props {
	appName: string;
}

export default function MetadataEditor({ appName }: Props) {
	const { app, loading: isLoading, error: appError } = useApp(appName);
	const [data, setData] = React.useState<KeyValueData | null>(null);
	const [isConfirming, setIsConfirming] = React.useState(false);
	const [isDeploying, setIsDeploying] = React.useState(false);
	const client = useClient();
	const callIfMounted = useCallIfMounted();

	React.useEffect(
		() => {
			if (!appError) return;
			handleError(appError);
		},
		[appError]
	);

	React.useEffect(
		() => {
			if (!app) return;

			// handle setting initial data
			if (!data) {
				setData(buildData(app.getLabelsMap().toArray()));
				return;
			}

			// handle app labels being updated elsewhere
			setData(rebaseData(data, app.getLabelsMap().toArray()));
		},
		[app] // eslint-disable-line react-hooks/exhaustive-deps
	);

	function handleConfirmSubmit(event: React.SyntheticEvent) {
		event.preventDefault();
		const app = new App();
		app.setName(appName);
		protoMapReplace(app.getLabelsMap(), new jspb.Map(getEntries(data as KeyValueData)));
		setIsDeploying(true);
		client.updateAppMeta(app, (app: App, error: Error | null) => {
			callIfMounted(() => {
				if (error) {
					setIsConfirming(false);
					setIsDeploying(false);
					return handleError(error);
				}
				setIsConfirming(false);
				setIsDeploying(false);
				setData(buildData(app.getLabelsMap().toArray()));
			});
		});
	}

	function handleCancelBtnClick(event?: React.SyntheticEvent) {
		if (event) {
			event.preventDefault();
		}
		setIsConfirming(false);
	}

	function renderDeployMetadata() {
		if (!app || !data) return;
		return (
			<Box tag="form" fill direction="column" onSubmit={handleConfirmSubmit}>
				<Box flex="grow">
					<h3>Review Changes</h3>
					<KeyValueDiff prev={app.getLabelsMap()} next={new jspb.Map(getEntries(data))} />
				</Box>
				<Box fill="horizontal" direction="row" align="end" gap="small" justify="between">
					<Button
						type="submit"
						disabled={isDeploying}
						primary
						icon={<CheckmarkIcon />}
						label={isDeploying ? 'Saving...' : 'Save'}
					/>
					<Button type="button" label="Cancel" onClick={handleCancelBtnClick} />
				</Box>
			</Box>
		);
	}

	if (isLoading) {
		return <Loading />;
	}

	return (
		<>
			{isConfirming ? <RightOverlay onClose={handleCancelBtnClick}>{renderDeployMetadata()}</RightOverlay> : null}
			<KeyValueEditor
				data={data || buildData([])}
				onChange={(data) => setData(data)}
				onSubmit={(data) => {
					setData(data);
					setIsConfirming(true);
				}}
			/>
		</>
	);
}