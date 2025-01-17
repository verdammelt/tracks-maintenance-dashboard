import React, { useCallback } from 'react'
import semver from 'semver'

import { RemoteConfig } from '../../net/RemoteConfig'
import { useTrackData } from '../../hooks/useTrackData'
import { useRemoteVersion } from '../../hooks/useRemoteVersion'
import { useToggleState } from '../../hooks/useToggleState'
import { useRemoteCanonicalVersion } from '../../hooks/useRemoteCanonicalVersion'

import { CheckOrCross } from './../CheckOrCross'
import { LoadingIndicator } from '../LoadingIndicator'
import { ContainedPopover } from '../Popover'
import { ExerciseIcon } from '../ExerciseIcon'

export function TrackVersions({ trackId }: { trackId: TrackIdentifier }): JSX.Element {

  return (
    <section>
      <header className="mb-4">
        <h2>Exercise Versions</h2>
      </header>

      <RemoteConfig trackId={trackId}>
        {({ config }) => (
          <ExerciseTable trackId={trackId} foregone={config.foregone} exercises={config.exercises} />
        )}
      </RemoteConfig>
    </section>
  )
}


const NO_EXCERCISES: ReadonlyArray<ExerciseConfiguration> = []
const NO_FOREGONE_EXERCISES: ReadonlyArray<string> = []

function ExerciseTable({
  trackId,
  exercises,
  foregone,
}: {
  trackId: TrackIdentifier
  exercises: ReadonlyArray<ExerciseConfiguration>
  foregone?: ReadonlyArray<string>
}) {
  const [details, setDetails] = useToggleState()
  const track = useTrackData(trackId)
  const validExercises = useValidExercises(foregone || NO_FOREGONE_EXERCISES, exercises)
  const { deprecated } = useInvalidExercises(foregone || NO_FOREGONE_EXERCISES, exercises)

  const renderExercise = useCallback(
    (exercise: ExerciseConfiguration) => {
      return (
        <ExerciseRow
          exercise={exercise}
          key={exercise.slug}
          trackId={trackId}
          detailsActive={details === exercise.slug}
          onToggleDetails={setDetails}
        />
      )
    },
    [details, setDetails, trackId]
  )

  if (!exercises || exercises.length === 0) {
    return <div>No exercises found</div>
  }

  return (
    <>
      <table className="table table-responsive" style={{ paddingBottom: '4.5rem' }}>
        <thead>
          <tr>
            <th style={{ minWidth: 256 }}>Exercise</th>
            <th style={{ minWidth: 200 }}>{track.name} version <VersionInfoButton trackData={track} /></th>
            <th style={{ minWidth: 200 }}>Canonical data version</th>
            <th style={{ minWidth: 64 }} />
          </tr>
        </thead>
        <tbody>{validExercises.map(renderExercise)}</tbody>
        <tfoot>
          <tr>
            <td colSpan={4}>
              <p className="text-muted mb-0">
                Showing <span className="badge badge-pill badge-primary">{validExercises.length}</span> out of <span className="badge badge-pill badge-secondary">{exercises.length}</span> exercises.
                Deprecated and foregone exercises are hidden.
              </p>
            </td>
          </tr>
        </tfoot>
      </table>

      <ForegoneSection exercises={foregone || NO_FOREGONE_EXERCISES} />
      <DeprecatedSection exercises={deprecated} />
    </>
  )
}

function VersionInfoButton({ trackData }: { trackData: TrackData }) {
  const { versioning } = trackData

  return (
    <ContainedPopover align="center" toggle={<span aria-label="more information" role="img">ℹ️</span>}>
      <p>
        The version information is fetched from the {trackData.name} repository, at <code>{versioning || '<unknown>'}</code>.
      </p>
      <p className="mb-0">The casing of the <code>{"{placeholder}"}</code> is matched.</p>
    </ContainedPopover>
  )
}

interface ExerciseRowProps {
  exercise: ExerciseConfiguration;
  trackId: TrackIdentifier;
  detailsActive: boolean;
  onToggleDetails(key: string): void;
}

function ExerciseRow({ exercise, trackId, detailsActive, onToggleDetails }: ExerciseRowProps) {
  const {
    done: remoteDone,
    version: remoteVersion,
    url: remoteUrl,
  } = useRemoteVersion(trackId, exercise.slug)
  const {
    done: canonicalDone,
    version: canonicalVersion,
    url: canonicalUrl,
  } = useRemoteCanonicalVersion(exercise.slug)

  const doToggle = useCallback(() => onToggleDetails(exercise.slug), [exercise, onToggleDetails])

  return (
    <tr key={exercise.slug}>
      <ExerciseNameCell exercise={exercise} />
      <VersionCell url={remoteUrl} version={remoteVersion} done={remoteDone} />
      <VersionCell url={canonicalUrl} version={canonicalVersion} done={canonicalDone} />
      <DetailsCell
        active={detailsActive}
        onToggle={doToggle}
        remoteVersion={remoteVersion}
        canonicalVersion={canonicalVersion}
        done={remoteDone && canonicalDone}
      />
    </tr>
  )
}

function ExerciseNameCell({ exercise }: { exercise: ExerciseConfiguration }) {
  const Cell = exercise.core ? 'th' : 'td'

  return (
    <Cell>
      <ExerciseIcon exercise={exercise.slug} size={24} />
      <span className="ml-2">{exercise.slug}</span>
    </Cell>
  )
}

function VersionCell({ url, version, done }: { url: string | undefined; version: string | undefined; done: boolean }) {
  return (
    <td>
      <a href={url}>
        <code>
          {version || ((done && '<none>') || <LoadingIndicator />)}
        </code>
      </a>
    </td>
  )
}

function DetailsCell({ active, onToggle, remoteVersion, canonicalVersion, done }: { active: boolean; onToggle(): void; remoteVersion: Version; canonicalVersion: Version; done: boolean }) {
  if (!done) {
    return (
      <td>
        <button type="button" style={{ background: 0, border: 0 }}>
          <span role="img" aria-label="Fetching versions...">⏳</span>
        </button>
      </td>
    )
  }

  const valid = testVersion(canonicalVersion, remoteVersion)

  return (
    <td>
      <ContainedPopover
          active={active}
          onToggle={onToggle}
          toggle={<CheckOrCross value={valid} />}
          align="right">
          {
            valid
            ? <VersionsMatch />
            : <VersionsDontMatch />
          }
        </ContainedPopover>
      </td>
  )
}

function VersionsMatch() {
  return (
    <p className="mb-0">
      The exercise is up-to-date with the latest canonical data.
    </p>
  )
}

function VersionsDontMatch() {
  return (
    <p className="mb-0">
      The version in the <code>exercism/problem-specifications</code> repository is
      higher than the local version. In order to resolve this, update the exercise by
      re-generating the <code>README.md</code> and updating the exericse tests.
    </p>
  )
}

function ForegoneSection({ exercises }: { exercises: ReadonlyArray<string> }) {
  if (!exercises || exercises.length === 0) {
    return null
  }

  return (
    <section className="mb-4">
      <h3>Foregone</h3>
      <p>
        Exercises listed here have the <code>forgone</code> flag set to <code>true</code>.
        This means that the track has <em>explicitely</em> chosen to forego
        implementing this exercise.
      </p>

      <ul>
        {exercises.map((exercise) => {
          return <li key={exercise}>{exercise}</li>
        })}
      </ul>
    </section>
  )
}

function DeprecatedSection({ exercises }: { exercises: ReadonlyArray<ExerciseConfiguration> }) {
  if (!exercises || exercises.length === 0) {
    return null
  }

  return (
    <section className="mb-4">
      <h3>Deprecated</h3>
      <p>
        Exercises listed here have the <code>deprecated</code> flag set to <code>true</code>.
        This means that the exercise has been implemented but will no longer be
        updated, as it's no longer considered part of the track.
      </p>

      <ul>
        {exercises.map((exercise) => {
          return <li key={exercise.slug}>{exercise.slug}</li>
        })}
      </ul>
    </section>
  )
}

function useValidExercises(foregone: ReadonlyArray<string>, exercises: ReadonlyArray<ExerciseConfiguration>) {
  if (!exercises) {
    return NO_EXCERCISES
  }

  return exercises.filter((exercise) => exercise.foregone !== true && foregone.indexOf(exercise.slug) === -1 && exercise.deprecated !== true)
}

function useInvalidExercises(foregone: ReadonlyArray<string>, exercises: ReadonlyArray<ExerciseConfiguration>) {
  if (!exercises) {
    return { foregone, deprecated: NO_EXCERCISES }
  }

  return exercises.reduce((result, exercise) => {
    if (exercise.foregone) {
      result.foregone.push(exercise.slug)
    }

    if (exercise.deprecated) {
      result.deprecated.push(exercise)
    }

    return result
  }, { foregone: [...foregone], deprecated: [] as  ExerciseConfiguration[]})
}

type Version = string | undefined
function testVersion(origin: Version, head: Version): boolean {
  if (head === undefined || origin === undefined) {
    // Version is fine if there is no canonical one
    return origin === undefined
  }

  // Version should be equal OR bigger than canonical
  return semver.gte(head, origin)
}
